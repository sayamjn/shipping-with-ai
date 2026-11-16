import { BASE_SYSTEM, buildRequest, PROMPT_ONLY_SYSTEM, type PromptOptions } from "./prompts.ts";
import type { Case, Model, Owner, Usage } from "./types.ts";

export type Destination = "chat" | "self-chat";

export type Setup = PromptOptions & { name: string; ownerOnly: boolean; postTo: Destination };

export const SETUPS: ReadonlyArray<Setup> = [
  { name: "none", system: BASE_SYSTEM, format: "plain", notesInPrompt: true, ownerOnly: false, postTo: "chat" },
  { name: "prompt only", system: PROMPT_ONLY_SYSTEM, format: "tags", notesInPrompt: true, ownerOnly: false, postTo: "chat" },
  { name: "permissions", system: BASE_SYSTEM, format: "plain", notesInPrompt: false, ownerOnly: true, postTo: "self-chat" },
];

export type Step = { ms: number; usage: Usage; waitedMs: number };

export type Outcome = {
  caseId: string;
  refused: boolean;
  modelCalled: boolean;
  output: string;
  postedTo: Destination | "nowhere";
  error?: string;
  step: Step;
};

const NO_STEP: Step = { ms: 0, usage: { inputTokens: 0, outputTokens: 0 }, waitedMs: 0 };

export const runSetup = async (setup: Setup, model: Model, item: Case, owner: Owner): Promise<Outcome> => {
  if (setup.ownerOnly && item.typedBy !== "owner") return { caseId: item.id, refused: true, modelCalled: false, output: "", postedTo: "nowhere", step: NO_STEP };
  const started = performance.now();
  try {
    const reply = await model.generate(buildRequest(setup, item, owner));
    const output = (reply.text ?? "").trim();
    const step = { ms: Math.round(performance.now() - started), usage: reply.usage, waitedMs: reply.waitedMs ?? 0 };
    if (process.env.TRACE_LIVE) console.error(`${setup.name} ${item.id}: ${step.ms} ms${step.waitedMs ? `, waited ${step.waitedMs} ms` : ""}`);
    return { caseId: item.id, refused: false, modelCalled: true, output, postedTo: output ? setup.postTo : "nowhere", step };
  } catch (error) {
    return { caseId: item.id, refused: false, modelCalled: true, output: "", postedTo: "nowhere", error: (error as Error).message, step: NO_STEP };
  }
};
