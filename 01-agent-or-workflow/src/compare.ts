import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { runAgent } from "./agent.ts";
import { geminiModel, scriptedModel } from "./models.ts";
import { totals } from "./trace.ts";
import type { Chat, RunResult } from "./types.ts";
import { runWorkflow } from "./workflow.ts";

const TODAY = "2026-11-10";

const chats: ReadonlyArray<Chat> = JSON.parse(readFileSync(new URL("../data/chats.json", import.meta.url), "utf8"));
const apiKey = process.env.GEMINI_API_KEY;
const model = apiKey && !process.argv.includes("--offline") ? geminiModel(apiKey) : scriptedModel(chats);

const row = (result: RunResult) => {
  const sum = totals(result.trace);
  const verified = result.findings.filter((finding) => finding.verified).length;
  return {
    approach: result.approach,
    stopped: result.stoppedBy,
    "model calls": sum.modelCalls,
    "tool calls": sum.toolCalls,
    "input tokens": sum.inputTokens,
    "output tokens": sum.outputTokens,
    "time (ms)": sum.ms,
    findings: result.findings.length,
    verified,
  };
};

const printTrace = (result: RunResult) => {
  console.log(`\n${result.approach} trace`);
  result.trace.forEach((step) => console.log(`  ${step.kind.padEnd(5)} ${String(step.ms).padStart(6)} ms  ${step.label}`));
  result.findings.forEach((finding) =>
    console.log(`  ${finding.verified ? "ok " : "BAD"} ${finding.kind.padEnd(14)} ${finding.chatId}/${finding.messageId} "${finding.quote}"${finding.reason ? ` (${finding.reason})` : ""}`),
  );
};

const workflow = await runWorkflow(chats, model, TODAY);
const agent = await runAgent(chats, model);

console.log(`model: ${model.name}`);
console.table([row(workflow), row(agent)]);
printTrace(workflow);
printTrace(agent);

mkdirSync(new URL("../results/", import.meta.url), { recursive: true });
const file = new URL(`../results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url);
writeFileSync(file, JSON.stringify({ model: model.name, workflow, agent }, null, 2));
console.log(`\nsaved ${file.pathname}`);
