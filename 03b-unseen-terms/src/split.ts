import type { RetrievalGrade } from "../../03-rag-is-search-first/src/metrics.ts";
import type { Entry } from "../../03-rag-is-search-first/src/types.ts";

const sum = (values: ReadonlyArray<number>) => values.reduce((total, value) => total + value, 0);

const countIn = (terms: ReadonlyArray<string>, group: ReadonlySet<string>) => terms.filter((term) => group.has(term)).length;

export const splitByTerm = (grades: ReadonlyArray<RetrievalGrade>, group: ReadonlyArray<Entry>) => {
  const terms = new Set(group.map((entry) => entry.term));
  return {
    needed: sum(grades.map((grade) => countIn(grade.found, terms) + countIn(grade.missed, terms))),
    found: sum(grades.map((grade) => countIn(grade.found, terms))),
    extra: sum(grades.map((grade) => countIn(grade.extra, terms))),
    wrongSense: sum(grades.map((grade) => countIn(grade.wrongSense, terms))),
  };
};

export const byLength = (grades: ReadonlyArray<RetrievalGrade>, group: ReadonlyArray<Entry>) => {
  const lengths = [...new Set(group.map((entry) => entry.term.split(" ").length))].sort((left, right) => left - right);
  return Object.fromEntries(
    lengths.map((length) => {
      const terms = new Set(group.filter((entry) => entry.term.split(" ").length === length).map((entry) => entry.term));
      return [length, { needed: sum(grades.map((grade) => countIn(grade.found, terms) + countIn(grade.missed, terms))), found: sum(grades.map((grade) => countIn(grade.found, terms))) }];
    }),
  );
};
