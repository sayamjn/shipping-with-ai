import { scoreRetrieval } from "../../03-rag-is-search-first/src/evaluate.ts";
import { RETRIEVERS } from "../../03-rag-is-search-first/src/retrievers.ts";
import type { Entry, Post } from "../../03-rag-is-search-first/src/types.ts";
import { exactUpTo, lookupKeys } from "./longer.ts";
import { byLength, splitByTerm } from "./split.ts";

const sum = (values: ReadonlyArray<number>) => values.reduce((total, value) => total + value, 0);

export const LOOKUP_LENGTHS = [2, 4] as const;

export const scoreAll = (posts: ReadonlyArray<Post>, glossaries: { tuned: ReadonlyArray<Entry>; unseen: ReadonlyArray<Entry>; all: ReadonlyArray<Entry> }) => ({
  retrieval: RETRIEVERS.map((retriever) => {
    const scored = scoreRetrieval(retriever, posts, glossaries.all);
    return { ...scored, tuned: splitByTerm(scored.grades, glossaries.tuned), unseen: splitByTerm(scored.grades, glossaries.unseen) };
  }),
  lookups: LOOKUP_LENGTHS.map((maxWords) => {
    const scored = scoreRetrieval(exactUpTo(maxWords), posts, glossaries.all);
    return {
      maxWords,
      totals: scored.totals,
      byLength: byLength(scored.grades, glossaries.all),
      keysBuilt: sum(posts.map((post) => lookupKeys(post.text, maxWords).length)),
      entriesSent: sum(scored.grades.map((grade) => grade.retrieved.length)),
      grades: scored.grades,
    };
  }),
});

export type Scores = ReturnType<typeof scoreAll>;
