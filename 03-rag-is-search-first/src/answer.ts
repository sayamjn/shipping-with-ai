import type { Entry, Model, ModelRequest, Post, Usage } from "./types.ts";

export const SYSTEM =
  "You write short social media posts for a café. The café has a house glossary of its own words. Rewrite the post in English, but use the glossary word in place of each glossary term, exactly as given. Keep everything else as it is. Reply with the rewritten post only.";

export const glossaryBlock = (entries: ReadonlyArray<Entry>) =>
  entries.length ? entries.map((entry) => `- ${entry.term} → ${entry.word}`).join("\n") : "(no entries)";

export const answerRequest = (post: Post, entries: ReadonlyArray<Entry>): ModelRequest => ({
  system: SYSTEM,
  turns: [{ role: "user", text: `Glossary (use exactly as provided):\n${glossaryBlock(entries)}\n\nPost: ${post.text}` }],
});

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const contains = (text: string, phrase: string) => new RegExp(`(^|[^\\p{L}])${escape(phrase)}(e?s)?([^\\p{L}]|$)`, "iu").test(text);

export type AnswerGrade = { postId: string; output: string; missingWords: ReadonlyArray<string>; wrongWords: ReadonlyArray<string>; pass: boolean; error?: string };

export const gradeAnswer = (post: Post, glossary: ReadonlyArray<Entry>, output: string): AnswerGrade => {
  const wordFor = (term: string) => glossary.find((entry) => entry.term === term)?.word ?? term;
  const missingWords = post.required.map(wordFor).filter((word) => !contains(output, word));
  const wrongWords = post.forbidden.map(wordFor).filter((word) => contains(output, word));
  return { postId: post.id, output, missingWords, wrongWords, pass: missingWords.length === 0 && wrongWords.length === 0 };
};

export const answerPost = async (model: Model, post: Post, glossary: ReadonlyArray<Entry>, entries: ReadonlyArray<Entry>) => {
  const started = performance.now();
  try {
    const reply = await model.generate(answerRequest(post, entries));
    const step = { ms: Math.round(performance.now() - started), usage: reply.usage, waitedMs: reply.waitedMs ?? 0 };
    if (process.env.TRACE_LIVE) console.error(`${post.id}: ${step.ms} ms${step.waitedMs ? `, waited ${step.waitedMs} ms` : ""}`);
    return { grade: gradeAnswer(post, glossary, reply.text ?? ""), step };
  } catch (error) {
    const usage: Usage = { inputTokens: 0, outputTokens: 0 };
    return { grade: { postId: post.id, output: "", missingWords: [], wrongWords: [], pass: false, error: (error as Error).message }, step: { ms: 0, usage, waitedMs: 0 } };
  }
};
