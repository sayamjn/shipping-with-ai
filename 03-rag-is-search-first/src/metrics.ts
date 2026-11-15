import type { Entry, Post } from "./types.ts";

export type RetrievalGrade = {
  postId: string;
  tags: ReadonlyArray<string>;
  retrieved: ReadonlyArray<string>;
  found: ReadonlyArray<string>;
  missed: ReadonlyArray<string>;
  extra: ReadonlyArray<string>;
  wrongSense: ReadonlyArray<string>;
  complete: boolean;
};

export const gradeRetrieval = (post: Post, entries: ReadonlyArray<Entry>): RetrievalGrade => {
  const retrieved = entries.map((entry) => entry.term);
  const missed = post.required.filter((term) => !retrieved.includes(term));
  return {
    postId: post.id,
    tags: post.tags,
    retrieved,
    found: post.required.filter((term) => retrieved.includes(term)),
    missed,
    extra: retrieved.filter((term) => !post.required.includes(term)),
    wrongSense: retrieved.filter((term) => post.forbidden.includes(term)),
    complete: missed.length === 0 && !retrieved.some((term) => post.forbidden.includes(term)),
  };
};

const sum = (values: ReadonlyArray<number>) => values.reduce((total, value) => total + value, 0);

export const retrievalTotals = (grades: ReadonlyArray<RetrievalGrade>) => ({
  posts: grades.length,
  complete: grades.filter((grade) => grade.complete).length,
  needed: sum(grades.map((grade) => grade.found.length + grade.missed.length)),
  found: sum(grades.map((grade) => grade.found.length)),
  extra: sum(grades.map((grade) => grade.extra.length)),
  wrongSense: sum(grades.map((grade) => grade.wrongSense.length)),
});

export const byTag = (grades: ReadonlyArray<RetrievalGrade>) => {
  const tags = [...new Set(grades.flatMap((grade) => grade.tags))];
  return Object.fromEntries(
    tags.map((tag) => {
      const tagged = grades.filter((grade) => grade.tags.includes(tag));
      return [tag, { posts: tagged.length, complete: tagged.filter((grade) => grade.complete).length }];
    }),
  );
};
