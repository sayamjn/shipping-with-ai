import { readFileSync } from "node:fs";
import type { Case, Owner } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8");

export const loadOwner = (): Owner => JSON.parse(read("owner.json"));

export const loadCases = (): ReadonlyArray<Case> =>
  read("cases.jsonl")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
