import type { PromptResult } from "./evaluate.ts";
import type { CaseGrade } from "./graders/code.ts";
import { totals } from "./trace.ts";

const fraction = (part: number, whole: number) => `${part}/${whole}`;

export const summaryRow = (result: PromptResult) => {
  const all = result.all.totals;
  const calibration = result.judge.calibration;
  return {
    prompt: result.version,
    "vibes cases passed": fraction(result.vibes.totals.casesPassed, result.vibes.totals.cases),
    "all cases passed": fraction(all.casesPassed, all.cases),
    "false positives": all.falsePositives,
    missed: fraction(all.missed, all.expected),
    "wrong kind": all.wrongKind,
    "judge agreement with labels": fraction(calibration.agreed, calibration.judged),
  };
};

export const usageRows = (result: PromptResult) =>
  ([["vibes pass", result.vibes.trace], ["all cases", result.all.trace], ["judge", result.judge.trace]] as const).map(([phase, trace]) => {
    const sum = totals(trace);
    return {
      prompt: result.version,
      phase,
      "model calls": sum.modelCalls,
      "input tokens": sum.inputTokens,
      "output tokens": sum.outputTokens,
      "thinking tokens": sum.thinkingTokens,
      "model time excl. waits (ms)": sum.ms - sum.waitedMs,
      "rate limit wait (ms)": sum.waitedMs,
    };
  });

const describeFailure = (grade: CaseGrade) => [
  ...(grade.error ? [`error: ${grade.error}`] : []),
  ...grade.missed.map((item) => `missed ${item.kind} ${item.chatId}/${item.messageId}`),
  ...grade.wrongKind.map((item) => `wrong kind at ${item.chatId}/${item.messageId} (expected ${item.kind})`),
  ...grade.findings
    .filter((finding) => finding.match === "unexpected")
    .map((finding) => `false positive ${finding.kind} ${finding.chatId}/${finding.messageId} "${finding.quote}"`),
  ...grade.findings.filter((finding) => !finding.verified).map((finding) => `quote check failed ${finding.chatId}/${finding.messageId} (${finding.reason})`),
];

export const failureLines = (result: PromptResult) =>
  result.all.grades
    .filter((grade) => !grade.pass)
    .map((grade) => `  ${result.version} ${grade.caseId} [${grade.tags.join(", ")}]: ${describeFailure(grade).join("; ")}`);

export const disagreementLines = (result: PromptResult) =>
  result.judge.calibration.disagreements.map(
    (item) => `  ${result.version} ${item.caseId} ${item.chatId}/${item.messageId} ${item.kind}: judge ${item.verdict}, labels say ${item.labelsSay} ("${item.reason}")`,
  );
