import { agentTools, runTool } from "./tools.ts";
import { timed } from "./trace.ts";
import type { Chat, Finding, Model, RunResult, TraceStep, Turn } from "./types.ts";
import { verifyFindings } from "./verify.ts";

export const MAX_STEPS = 15;

const SYSTEM =
  "You help Sayam triage WhatsApp. Use the tools to decide which chats to read. Find what is waiting on him and what he promised, copying quotes exactly. Read only what you need, then call finish once.";

export const runAgent = async (chats: ReadonlyArray<Chat>, model: Model, maxSteps = MAX_STEPS): Promise<RunResult> => {
  const turns: Turn[] = [{ role: "user", text: "Triage my chats for today." }];
  const trace: TraceStep[] = [];
  for (let step = 1; step <= maxSteps; step++) {
    const reply = await timed("model", `step ${step}: decide the next action`, () => model.generate({ system: SYSTEM, turns, tools: agentTools }), (value) => value.usage);
    trace.push(reply.step);
    if (process.env.TRACE_LIVE) console.error(`agent step ${step}: ${reply.step.ms} ms${reply.step.waitedMs ? `, waited ${reply.step.waitedMs} ms` : ""}`);
    const calls = reply.value.toolCalls;
    if (!calls.length) return { approach: "agent", model: model.name, findings: [], trace, stoppedBy: "error" };
    turns.push({ role: "model", text: reply.value.text, toolCalls: calls });
    const finish = calls.find((call) => call.name === "finish");
    if (finish) {
      const findings = (finish.args.findings ?? []) as ReadonlyArray<Finding>;
      const checked = await timed("code", "check every quote against its message", () => verifyFindings(findings, chats));
      return { approach: "agent", model: model.name, findings: checked.value, trace: [...trace, checked.step], stoppedBy: "done" };
    }
    for (const call of calls) {
      const result = await timed("tool", `${call.name}${call.args.chatId ? ` ${String(call.args.chatId)}` : ""}`, () => runTool(call.name, call.args, chats));
      trace.push(result.step);
      turns.push({ role: "tool", name: call.name, callId: call.id, result: result.value });
    }
  }
  return { approach: "agent", model: model.name, findings: [], trace, stoppedBy: "step_limit" };
};
