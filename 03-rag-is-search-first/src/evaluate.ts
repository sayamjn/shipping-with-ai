import { answerPost, SYSTEM } from "./answer.ts";
import { loadGlossary, loadPosts } from "./data.ts";
import { byTag, gradeRetrieval, retrievalTotals } from "./metrics.ts";
import { exactMatch, hybridMatch, oracle, RETRIEVERS } from "./retrievers.ts";
import { mapSequential } from "./sequential.ts";
import type { Entry, Model, Post, Retriever } from "./types.ts";

export const ANSWER_RETRIEVERS: ReadonlyArray<Retriever> = [exactMatch, hybridMatch, oracle];

export const scoreRetrieval = (retriever: Retriever, posts: ReadonlyArray<Post>, glossary: ReadonlyArray<Entry>) => {
  const grades = posts.map((post) => gradeRetrieval(post, retriever.retrieve(post.text, glossary, post)));
  return { retriever: retriever.name, totals: retrievalTotals(grades), byTag: byTag(grades), grades };
};

const answerWith = async (model: Model, retriever: Retriever, posts: ReadonlyArray<Post>, glossary: ReadonlyArray<Entry>) => {
  const results = await mapSequential(posts, (post) => answerPost(model, post, glossary, retriever.retrieve(post.text, glossary, post)));
  return { retriever: retriever.name, grades: results.map((result) => result.grade), steps: results.map((result) => result.step) };
};

export type AnswerRun = Awaited<ReturnType<typeof answerWith>>;

export const runEval = async (model: Model, posts: ReadonlyArray<Post> = loadPosts(), glossary: ReadonlyArray<Entry> = loadGlossary()) => ({
  model: model.name,
  startedAt: new Date().toISOString(),
  posts: posts.length,
  glossaryEntries: glossary.length,
  system: SYSTEM,
  retrieval: RETRIEVERS.map((retriever) => scoreRetrieval(retriever, posts, glossary)),
  answers: await mapSequential(ANSWER_RETRIEVERS, (retriever) => answerWith(model, retriever, posts, glossary)),
});

export type EvalRun = Awaited<ReturnType<typeof runEval>>;
