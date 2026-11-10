import { pickCandidates } from "./rank.ts";
import { findingSchema } from "./tools.ts";
import { timed } from "./trace.ts";
import type { Chat, Finding, Model, RunResult } from "./types.ts";
import { verifyFindings } from "./verify.ts";

const SYSTEM =
  "You read WhatsApp chats for Sayam. Return only what is waiting on him (someone asked him something) and what he promised. Copy the quote exactly from the message.";

const parseFindings = (text: string | undefined): ReadonlyArray<Finding> => {
  try {
    const parsed = JSON.parse(text ?? "{}");
    return Array.isArray(parsed.findings) ? parsed.findings : [];
  } catch {
    return [];
  }
};

export const runWorkflow = async (chats: ReadonlyArray<Chat>, model: Model, today: string): Promise<RunResult> => {
  const ranked = await timed("code", "rank chats and apply the token budget", () => pickCandidates(chats, today));
  const sent = ranked.value.map(({ chat }) => chat);
  const prompt = `Chats:\n${JSON.stringify(sent)}`;
  const reply = await timed("model", `extract findings from ${sent.length} chats`, () =>
    model.generate({ system: SYSTEM, turns: [{ role: "user", text: prompt }], jsonSchema: findingSchema }),
  (value) => value.usage);
  const checked = await timed("code", "check every quote against its message", () => verifyFindings(parseFindings(reply.value.text), chats));
  return { approach: "workflow", model: model.name, findings: checked.value, trace: [ranked.step, reply.step, checked.step], stoppedBy: "done" };
};
