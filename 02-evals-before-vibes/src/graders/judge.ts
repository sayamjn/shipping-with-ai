import { JUDGE_SYSTEM, judgePrompt } from "../prompts.ts";
import { verdictSchema } from "../schemas.ts";
import { mapSequential } from "../sequential.ts";
import { timed } from "../trace.ts";
import type { Case, ExpectedFinding, Finding, Model, TraceStep } from "../types.ts";

export type Verdict = "pass" | "fail" | "not_judged";

export type JudgeVerdict = { caseId: string; chatId: string; messageId: string; kind: Finding["kind"]; quote: string; verdict: Verdict; reason: string };

export type Disagreement = JudgeVerdict & { labelsSay: "correct" | "incorrect" };

export const parseVerdict = (text: string | undefined): { verdict: Verdict; reason: string } => {
  try {
    const parsed = JSON.parse(text ?? "");
    if (parsed.verdict !== "pass" && parsed.verdict !== "fail") return { verdict: "not_judged", reason: "judge returned no pass or fail" };
    return { verdict: parsed.verdict, reason: typeof parsed.reason === "string" ? parsed.reason : "" };
  } catch {
    return { verdict: "not_judged", reason: "judge reply was not JSON" };
  }
};

const judgeOne = async (model: Model, testCase: Case, finding: Finding) => {
  const base = { caseId: testCase.id, chatId: finding.chatId, messageId: finding.messageId, kind: finding.kind, quote: finding.quote };
  const chat = testCase.chats.find((candidate) => candidate.id === finding.chatId);
  if (!chat) return { verdict: { ...base, verdict: "not_judged" as const, reason: "unknown chat" }, steps: [] };
  try {
    const reply = await timed("model", `judge ${testCase.id} ${finding.chatId}/${finding.messageId}`, () =>
      model.generate({ system: JUDGE_SYSTEM, turns: [{ role: "user", text: judgePrompt(chat, finding) }], jsonSchema: verdictSchema, schemaName: "verdict" }),
    (value) => value.usage);
    return { verdict: { ...base, ...parseVerdict(reply.value.text) }, steps: [reply.step] };
  } catch (error) {
    return { verdict: { ...base, verdict: "not_judged" as const, reason: `judge call failed: ${(error as Error).message}` }, steps: [] };
  }
};

export const judgeFindings = async (model: Model, items: ReadonlyArray<{ testCase: Case; finding: Finding }>) => {
  const judged = await mapSequential(items, ({ testCase, finding }) => judgeOne(model, testCase, finding));
  return { verdicts: judged.map((item): JudgeVerdict => item.verdict), trace: judged.flatMap((item): ReadonlyArray<TraceStep> => item.steps) };
};

const matchesLabel = (verdict: JudgeVerdict, expected: ReadonlyArray<ExpectedFinding>) =>
  expected.some((item) => item.chatId === verdict.chatId && item.messageId === verdict.messageId && item.kind === verdict.kind);

export const calibrate = (verdicts: ReadonlyArray<JudgeVerdict>, labels: ReadonlyArray<Pick<Case, "id" | "expected">>) => {
  const labelled = verdicts.map((verdict): Disagreement => {
    const expected = labels.find((label) => label.id === verdict.caseId)?.expected ?? [];
    return { ...verdict, labelsSay: matchesLabel(verdict, expected) ? "correct" : "incorrect" };
  });
  const judged = labelled.filter((item) => item.verdict !== "not_judged");
  const disagreements = judged.filter((item) => (item.verdict === "pass") !== (item.labelsSay === "correct"));
  return {
    judged: judged.length,
    agreed: judged.length - disagreements.length,
    notJudged: labelled.length - judged.length,
    judgePassedLabelsRejected: disagreements.filter((item) => item.verdict === "pass").length,
    judgeFailedLabelsAccepted: disagreements.filter((item) => item.verdict === "fail").length,
    disagreements,
  };
};
