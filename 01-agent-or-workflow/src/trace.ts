import type { TraceStep, Usage } from "./types.ts";

export const timed = async <T>(kind: TraceStep["kind"], label: string, work: () => Promise<T> | T, usageOf?: (value: T) => Usage) => {
  const started = performance.now();
  const value = await work();
  const step: TraceStep = { kind, label, ms: Math.round(performance.now() - started), ...(usageOf ? { usage: usageOf(value) } : {}) };
  return { value, step };
};

export const totals = (trace: ReadonlyArray<TraceStep>) => ({
  modelCalls: trace.filter((step) => step.kind === "model").length,
  toolCalls: trace.filter((step) => step.kind === "tool").length,
  inputTokens: trace.reduce((sum, step) => sum + (step.usage?.inputTokens ?? 0), 0),
  outputTokens: trace.reduce((sum, step) => sum + (step.usage?.outputTokens ?? 0), 0),
  ms: trace.reduce((sum, step) => sum + step.ms, 0),
});
