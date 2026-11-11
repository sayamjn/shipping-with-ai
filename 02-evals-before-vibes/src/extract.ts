import { PROMPTS, extractionPrompt, type PromptVersion } from "./prompts.ts";
import { findingSchema } from "./schemas.ts";
import { timed } from "./trace.ts";
import type { Case, Finding, Model } from "./types.ts";

const KINDS: ReadonlyArray<string> = ["waiting_on_me", "i_promised"];

const isFinding = (item: unknown): item is Finding => {
  const candidate = item as Record<string, unknown> | null;
  return (
    typeof candidate?.chatId === "string" &&
    typeof candidate.messageId === "string" &&
    typeof candidate.quote === "string" &&
    KINDS.includes(candidate.kind as string)
  );
};

export const parseFindings = (text: string | undefined): ReadonlyArray<Finding> => {
  try {
    const parsed = JSON.parse(text ?? "{}");
    const items: ReadonlyArray<unknown> = Array.isArray(parsed.findings) ? parsed.findings : [];
    return items.filter(isFinding).map((item) => ({ ...item, summary: typeof item.summary === "string" ? item.summary : "" }));
  } catch {
    return [];
  }
};

export const extractCase = async (model: Model, version: PromptVersion, testCase: Case) => {
  const reply = await timed("model", `${version} extract ${testCase.id}`, () =>
    model.generate({ system: PROMPTS[version], turns: [{ role: "user", text: extractionPrompt(testCase.chats) }], jsonSchema: findingSchema, schemaName: "findings" }),
  (value) => value.usage);
  return { findings: parseFindings(reply.value.text), step: reply.step };
};
