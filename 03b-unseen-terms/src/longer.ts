import { phrases, words } from "../../03-rag-is-search-first/src/text.ts";
import type { Entry, Retriever } from "../../03-rag-is-search-first/src/types.ts";

const STOP_WORDS = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"]);

export const lookupKeys = (text: string, maxWords: number) =>
  [...new Set(phrases(words(text), maxWords))].filter((term) => term.length > 2 && !STOP_WORDS.has(term) && !/^\d+$/.test(term));

export const exactUpTo = (maxWords: number): Retriever => ({
  name: `exact, lookups up to ${maxWords} words`,
  retrieve: (text, glossary: ReadonlyArray<Entry>) => {
    const keys = new Set(lookupKeys(text, maxWords));
    return glossary.filter((entry) => keys.has(entry.term));
  },
});
