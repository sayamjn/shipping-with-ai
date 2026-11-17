import { gradeAnswer } from "../../03-rag-is-search-first/src/answer.ts";
import type { Entry, Post, Usage } from "../../03-rag-is-search-first/src/types.ts";

export type PostScore = {
  postId: string;
  pass: boolean;
  wrongSupplied: number;
  wrongUsed: number;
  requiredSupplied: number;
  requiredLost: number;
  usage: Usage;
  output: string;
  error?: string;
};

const wordsOf = (entries: ReadonlyArray<Entry>) => entries.map((entry) => entry.word);

export const scorePost = (post: Post, glossary: ReadonlyArray<Entry>, entries: ReadonlyArray<Entry>, output: string, usage: Usage): PostScore => {
  const grade = gradeAnswer(post, glossary, output);
  const wrongEntries = entries.filter((entry) => post.forbidden.includes(entry.term));
  const requiredEntries = entries.filter((entry) => post.required.includes(entry.term));
  const suppliedRequiredWords = wordsOf(requiredEntries);
  return {
    postId: post.id,
    pass: grade.pass,
    wrongSupplied: wrongEntries.length,
    wrongUsed: wordsOf(wrongEntries).filter((word) => grade.wrongWords.includes(word)).length,
    requiredSupplied: requiredEntries.length,
    requiredLost: grade.missingWords.filter((word) => suppliedRequiredWords.includes(word)).length,
    usage,
    output,
  };
};

const sum = (scores: ReadonlyArray<PostScore>, pick: (score: PostScore) => number) => scores.reduce((total, score) => total + pick(score), 0);

export const totals = (scores: ReadonlyArray<PostScore>) => ({
  posts: scores.length,
  passed: scores.filter((score) => score.pass).length,
  errors: scores.filter((score) => score.error).length,
  wrongSupplied: sum(scores, (score) => score.wrongSupplied),
  wrongUsed: sum(scores, (score) => score.wrongUsed),
  wrongAvoided: sum(scores, (score) => score.wrongSupplied - score.wrongUsed),
  requiredSupplied: sum(scores, (score) => score.requiredSupplied),
  requiredLost: sum(scores, (score) => score.requiredLost),
  inputTokens: sum(scores, (score) => score.usage.inputTokens),
  outputTokens: sum(scores, (score) => score.usage.outputTokens),
  thinkingTokens: sum(scores, (score) => score.usage.thinkingTokens ?? 0),
});
