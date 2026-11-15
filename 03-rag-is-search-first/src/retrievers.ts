import { lookupTerms, normalisePhrase, phrases, similarity, words } from "./text.ts";
import type { Entry, Retriever } from "./types.ts";

export const FUZZY_THRESHOLD = 0.75;

const unique = (entries: ReadonlyArray<Entry>) => entries.filter((entry, idx) => entries.findIndex((other) => other.term === entry.term) === idx);

export const exactMatch: Retriever = {
  name: "exact",
  retrieve: (text, glossary) => {
    const terms = new Set(lookupTerms(text));
    return glossary.filter((entry) => terms.has(entry.term));
  },
};

export const normalisedMatch: Retriever = {
  name: "normalised",
  retrieve: (text, glossary) => {
    const terms = new Set(lookupTerms(text).map(normalisePhrase));
    return glossary.filter((entry) => terms.has(normalisePhrase(entry.term)));
  },
};

export const fuzzyMatch: Retriever = {
  name: "fuzzy",
  retrieve: (text, glossary) => {
    const candidates = phrases(words(text));
    return glossary.filter((entry) => {
      const size = entry.term.split(" ").length;
      return candidates.some((candidate) => candidate.split(" ").length === size && similarity(candidate, entry.term) >= FUZZY_THRESHOLD);
    });
  },
};

export const hybridMatch: Retriever = {
  name: "normalised + fuzzy",
  retrieve: (text, glossary, post) => unique([...normalisedMatch.retrieve(text, glossary, post), ...fuzzyMatch.retrieve(text, glossary, post)]),
};

export const oracle: Retriever = {
  name: "oracle (labels)",
  retrieve: (_, glossary, post) => glossary.filter((entry) => post.required.includes(entry.term)),
};

export const RETRIEVERS: ReadonlyArray<Retriever> = [exactMatch, normalisedMatch, fuzzyMatch, hybridMatch, oracle];
