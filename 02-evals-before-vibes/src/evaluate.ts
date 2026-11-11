import { loadCases, vibesCases } from "./cases.ts";
import { extractCase } from "./extract.ts";
import { erroredCase, gradeCase, gradeTotals, type CaseGrade } from "./graders/code.ts";
import { calibrate, judgeFindings } from "./graders/judge.ts";
import { JUDGE_QUESTIONS, JUDGE_SYSTEM, PROMPTS, PROMPT_VERSIONS, type PromptVersion } from "./prompts.ts";
import { mapSequential } from "./sequential.ts";
import type { Case, Model, TraceStep } from "./types.ts";

const runCases = async (model: Model, version: PromptVersion, cases: ReadonlyArray<Case>) => {
  const results = await mapSequential(cases, async (testCase): Promise<{ grade: CaseGrade; steps: ReadonlyArray<TraceStep> }> => {
    try {
      const extracted = await extractCase(model, version, testCase);
      return { grade: gradeCase(testCase, extracted.findings), steps: [extracted.step] };
    } catch (error) {
      return { grade: erroredCase(testCase, (error as Error).message), steps: [] };
    }
  });
  const grades = results.map((result) => result.grade);
  return { grades, totals: gradeTotals(grades), trace: results.flatMap((result) => result.steps) };
};

export const evaluatePrompt = async (model: Model, version: PromptVersion, cases: ReadonlyArray<Case>) => {
  const vibes = await runCases(model, version, vibesCases(cases));
  const all = await runCases(model, version, cases);
  const toJudge = all.grades.flatMap((grade) => {
    const testCase = cases.find((candidate) => candidate.id === grade.caseId);
    return testCase ? grade.findings.map((finding) => ({ testCase, finding })) : [];
  });
  const judged = await judgeFindings(model, toJudge);
  return { version, vibes, all, judge: { verdicts: judged.verdicts, calibration: calibrate(judged.verdicts, cases), trace: judged.trace } };
};

export type PromptResult = Awaited<ReturnType<typeof evaluatePrompt>>;

export const runEval = async (model: Model, cases: ReadonlyArray<Case> = loadCases()) => ({
  model: model.name,
  startedAt: new Date().toISOString(),
  cases: cases.length,
  prompts: PROMPTS,
  judge: { system: JUDGE_SYSTEM, questions: JUDGE_QUESTIONS },
  results: await mapSequential(PROMPT_VERSIONS, (version) => evaluatePrompt(model, version, cases)),
});
