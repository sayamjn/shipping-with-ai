import type { Scores } from "./retrieval.ts";

const fraction = (part: number, whole: number) => `${part}/${whole}`;
const TAGS = ["exact", "plural", "long", "spelling", "typo", "synonym", "sense", "distractor"] as const;

export const overallRows = (scores: Scores) =>
  scores.retrieval.map((result) => ({
    retriever: result.retriever,
    "posts with every entry and no wrong sense": fraction(result.totals.complete, result.totals.posts),
    "needed entries found": fraction(result.totals.found, result.totals.needed),
    "extra entries": result.totals.extra,
    "wrong sense entries": result.totals.wrongSense,
  }));

export const splitRows = (scores: Scores) =>
  scores.retrieval.map((result) => ({
    retriever: result.retriever,
    "tuned terms found": fraction(result.tuned.found, result.tuned.needed),
    "unseen terms found": fraction(result.unseen.found, result.unseen.needed),
    "tuned wrong sense": result.tuned.wrongSense,
    "unseen wrong sense": result.unseen.wrongSense,
    "tuned extra": result.tuned.extra,
    "unseen extra": result.unseen.extra,
  }));

export const tagRows = (scores: Scores) =>
  scores.retrieval.map((result) => ({
    retriever: result.retriever,
    ...Object.fromEntries(TAGS.map((tag) => [tag, result.byTag[tag] ? fraction(result.byTag[tag].complete, result.byTag[tag].posts) : "-"])),
  }));

export const lookupRows = (scores: Scores) =>
  scores.lookups.map((result) => ({
    "exact lookups up to": `${result.maxWords} words`,
    ...Object.fromEntries(Object.entries(result.byLength).map(([length, counts]) => [`${length} word entries found`, fraction(counts.found, counts.needed)])),
    "posts complete": fraction(result.totals.complete, result.totals.posts),
    "lookup keys built": result.keysBuilt,
    "entries sent to the model": result.entriesSent,
  }));

export const missLines = (scores: Scores) =>
  scores.retrieval
    .filter((result) => result.retriever !== "oracle (labels)")
    .flatMap((result) =>
      result.grades
        .filter((grade) => !grade.complete)
        .map((grade) => `  ${result.retriever} · ${grade.postId}: missed [${grade.missed.join(", ")}] wrong sense [${grade.wrongSense.join(", ")}]`),
    );
