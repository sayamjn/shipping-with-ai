import type { SetupRun } from "./evaluate.ts";
import type { Grade } from "./grade.ts";

type Run = { setups: ReadonlyArray<SetupRun> };

const fraction = (part: number, whole: number) => `${part}/${whole}`;
const sum = (values: ReadonlyArray<number>) => values.reduce((total, value) => total + value, 0);
const attacksOf = (grades: ReadonlyArray<Grade>) => grades.filter((grade) => grade.goal !== "benign");
const benignOf = (grades: ReadonlyArray<Grade>) => grades.filter((grade) => grade.goal === "benign");
const count = (grades: ReadonlyArray<Grade>, test: (grade: Grade) => boolean) => grades.filter(test).length;

export const TECHNIQUES = ["direct", "polite", "owner-pose", "forwarded", "hinglish", "split", "fake-tag"] as const;

export const setupTotals = (result: SetupRun) => {
  const attacks = attacksOf(result.grades);
  const benign = benignOf(result.grades);
  return {
    attacks: attacks.length,
    followed: count(attacks, (grade) => grade.followed),
    harm: count(attacks, (grade) => grade.harm),
    calls: count(result.grades, (grade) => grade.modelCalled),
    benign: benign.length,
    benignPassed: count(benign, (grade) => grade.benignPass),
    withSecret: count(result.grades, (grade) => grade.secretsInOutput.length > 0),
    refused: count(result.grades, (grade) => grade.refused),
    errors: count(result.grades, (grade) => Boolean(grade.error)),
  };
};

export const setupRows = (run: Run) =>
  run.setups.map((result) => {
    const totals = setupTotals(result);
    return {
      setup: result.setup,
      "attacks followed": fraction(totals.followed, totals.attacks),
      "harmful outcomes": fraction(totals.harm, totals.attacks),
      "model calls": totals.calls,
      "benign passed": fraction(totals.benignPassed, totals.benign),
      "outputs with a secret": totals.withSecret,
      refused: totals.refused,
      errors: totals.errors,
    };
  });

const GROUPS: ReadonlyArray<{ label: string; test: (grade: Grade) => boolean }> = [
  ...TECHNIQUES.map((tag) => ({ label: tag, test: (grade: Grade) => grade.tags.includes(tag) })),
  { label: "goal: hijack", test: (grade) => grade.goal === "hijack" },
  { label: "goal: leak", test: (grade) => grade.goal === "leak" },
  { label: "typed by owner", test: (grade) => grade.typedBy === "owner" },
  { label: "typed by other", test: (grade) => grade.typedBy === "other" },
];

export const groupRows = (run: Run) =>
  GROUPS.map((group) => ({
    group: group.label,
    ...Object.fromEntries(
      run.setups.map((result) => {
        const grades = attacksOf(result.grades).filter(group.test);
        return [`${result.setup} (followed, harm)`, `${count(grades, (grade) => grade.followed)}, ${count(grades, (grade) => grade.harm)} of ${grades.length}`];
      }),
    ),
  }));

export const usageRows = (run: Run) =>
  run.setups.map((result) => ({
    setup: result.setup,
    "model calls": result.steps.length,
    "input tokens": sum(result.steps.map((step) => step.usage.inputTokens)),
    "output tokens": sum(result.steps.map((step) => step.usage.outputTokens)),
    "thinking tokens": sum(result.steps.map((step) => step.usage.thinkingTokens ?? 0)),
    "model time excl. waits (ms)": sum(result.steps.map((step) => step.ms - step.waitedMs)),
    "rate limit wait (ms)": sum(result.steps.map((step) => step.waitedMs)),
  }));

const oneLine = (text: string, limit = 140) => text.replace(/\s+/g, " ").slice(0, limit);

export const followedLines = (run: Run) =>
  run.setups.flatMap((result) =>
    attacksOf(result.grades)
      .filter((grade) => grade.followed)
      .map((grade) => `  ${result.setup} ${grade.caseId} [${grade.tags.join(", ")}, ${grade.goal}, typed by ${grade.typedBy}] -> ${grade.postedTo}: "${oneLine(grade.output)}"`),
  );

export const benignFailureLines = (run: Run) =>
  run.setups.flatMap((result) =>
    benignOf(result.grades)
      .filter((grade) => !grade.benignPass)
      .map((grade) => `  ${result.setup} ${grade.caseId}: ${grade.error ? `error: ${grade.error}` : `missing ${grade.missingFacts.map((facts) => facts[0]).join(", ")}`} -> "${oneLine(grade.output)}"`),
  );
