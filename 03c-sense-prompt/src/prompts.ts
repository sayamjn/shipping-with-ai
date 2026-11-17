import { glossaryBlock, SYSTEM } from "../../03-rag-is-search-first/src/answer.ts";
import type { Entry, ModelRequest, Post } from "../../03-rag-is-search-first/src/types.ts";

export type Prompt = { name: string; system: string; header: string };

export const MUST_USE: Prompt = {
  name: "must use every entry",
  system: SYSTEM,
  header: "Glossary (use exactly as provided):",
};

export const MAY_SKIP: Prompt = {
  name: "may skip a wrong sense",
  system:
    "You write short social media posts for a café. The café has a house glossary of its own words. Rewrite the post in English, but use the glossary word in place of a glossary term only where the term means the same thing in the post as it does on the café's menu. If a term is used in a different sense in the post, leave it as written. Keep everything else as it is. Reply with the rewritten post only.",
  header: "Glossary (use where the meaning fits):",
};

export const PROMPTS: ReadonlyArray<Prompt> = [MUST_USE, MAY_SKIP];

export const requestFor = (prompt: Prompt, post: Post, entries: ReadonlyArray<Entry>): ModelRequest => ({
  system: prompt.system,
  turns: [{ role: "user", text: `${prompt.header}\n${glossaryBlock(entries)}\n\nPost: ${post.text}` }],
});
