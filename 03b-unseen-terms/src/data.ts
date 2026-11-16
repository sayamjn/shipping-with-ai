import { readFileSync } from "node:fs";
import { loadGlossary } from "../../03-rag-is-search-first/src/data.ts";
import type { Entry, Post } from "../../03-rag-is-search-first/src/types.ts";

const read = (name: string) => readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8");

export const loadTunedGlossary = (): ReadonlyArray<Entry> => loadGlossary();

export const loadUnseenGlossary = (): ReadonlyArray<Entry> => JSON.parse(read("glossary-unseen.json"));

export const loadGlossaries = () => {
  const tuned = loadTunedGlossary();
  const unseen = loadUnseenGlossary();
  return { tuned, unseen, all: [...tuned, ...unseen] };
};

export const loadPosts = (): ReadonlyArray<Post> =>
  read("posts.jsonl")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
