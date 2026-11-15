import { readFileSync } from "node:fs";
import type { Entry, Post } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8");

export const loadGlossary = (): ReadonlyArray<Entry> => JSON.parse(read("glossary.json"));

export const loadPosts = (): ReadonlyArray<Post> =>
  read("posts.jsonl")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
