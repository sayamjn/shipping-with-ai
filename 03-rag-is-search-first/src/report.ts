import type { AnswerRun, EvalRun } from "./evaluate.ts";

const fraction = (part: number, whole: number) => `${part}/${whole}`;
const sum = (values: ReadonlyArray<number>) => values.reduce((total, value) => total + value, 0);
const TAGS = ["exact", "plural", "phrase", "typo", "synonym", "distractor"] as const;

export const retrievalRows = (run: EvalRun) =>
  run.retrieval.map((result) => ({
    retriever: result.retriever,
    "posts with every entry and no wrong sense": fraction(result.totals.complete, result.totals.posts),
    "needed entries found": fraction(result.totals.found, result.totals.needed),
    "extra entries": result.totals.extra,
    "wrong sense entries": result.totals.wrongSense,
  }));

export const tagRows = (run: EvalRun) =>
  run.retrieval.map((result) => ({
    retriever: result.retriever,
    ...Object.fromEntries(TAGS.map((tag) => [tag, result.byTag[tag] ? fraction(result.byTag[tag].complete, result.byTag[tag].posts) : "-"])),
  }));

const retrievalFor = (run: EvalRun, answers: AnswerRun) => run.retrieval.find((result) => result.retriever === answers.retriever);

export const answerRows = (run: EvalRun) =>
  run.answers.map((answers) => {
    const retrieval = retrievalFor(run, answers);
    const completeIds = new Set(retrieval?.grades.filter((grade) => grade.complete).map((grade) => grade.postId));
    const withComplete = answers.grades.filter((grade) => completeIds.has(grade.postId));
    const withGaps = answers.grades.filter((grade) => !completeIds.has(grade.postId));
    return {
      retriever: answers.retriever,
      "posts right": fraction(answers.grades.filter((grade) => grade.pass).length, answers.grades.length),
      "right when retrieval was complete": fraction(withComplete.filter((grade) => grade.pass).length, withComplete.length),
      "right when retrieval had a gap": fraction(withGaps.filter((grade) => grade.pass).length, withGaps.length),
      errors: answers.grades.filter((grade) => grade.error).length,
    };
  });

export const usageRows = (run: EvalRun) =>
  run.answers.map((answers) => ({
    retriever: answers.retriever,
    "model calls": answers.steps.length,
    "input tokens": sum(answers.steps.map((step) => step.usage.inputTokens)),
    "output tokens": sum(answers.steps.map((step) => step.usage.outputTokens)),
    "thinking tokens": sum(answers.steps.map((step) => step.usage.thinkingTokens ?? 0)),
    "model time excl. waits (ms)": sum(answers.steps.map((step) => step.ms - step.waitedMs)),
    "rate limit wait (ms)": sum(answers.steps.map((step) => step.waitedMs)),
  }));

export const failureLines = (run: EvalRun) =>
  run.answers.flatMap((answers) =>
    answers.grades
      .filter((grade) => !grade.pass)
      .map((grade) => {
        const retrieval = retrievalFor(run, answers)?.grades.find((item) => item.postId === grade.postId);
        const why = [
          ...(grade.error ? [`error: ${grade.error}`] : []),
          ...(retrieval?.missed.length ? [`not retrieved: ${retrieval.missed.join(", ")}`] : []),
          ...(retrieval?.wrongSense.length ? [`wrong sense retrieved: ${retrieval.wrongSense.join(", ")}`] : []),
          ...(grade.missingWords.length ? [`missing in output: ${grade.missingWords.join(", ")}`] : []),
          ...(grade.wrongWords.length ? [`wrong word in output: ${grade.wrongWords.join(", ")}`] : []),
        ];
        return `  ${answers.retriever} ${grade.postId} [${retrieval?.tags.join(", ")}]: ${why.join("; ")} -> "${grade.output.replace(/\s+/g, " ").slice(0, 120)}"`;
      }),
  );
