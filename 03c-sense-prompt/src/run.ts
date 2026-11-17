import { mkdirSync, writeFileSync } from "node:fs";
import { groqModel } from "../../03-rag-is-search-first/src/groq.ts";
import { hybridMatch, oracle } from "../../03-rag-is-search-first/src/retrievers.ts";
import { mapSequential } from "../../03-rag-is-search-first/src/sequential.ts";
import type { Entry, Model, Post, Retriever, Usage } from "../../03-rag-is-search-first/src/types.ts";
import { loadGlossaries, loadPosts } from "../../03b-unseen-terms/src/data.ts";
import { exactUpTo } from "../../03b-unseen-terms/src/longer.ts";
import { MUST_USE, PROMPTS, requestFor, type Prompt } from "./prompts.ts";
import { scorePost, totals, type PostScore } from "./score.ts";

const NO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, thinkingTokens: 0 };

const answer = async (model: Model, prompt: Prompt, post: Post, glossary: ReadonlyArray<Entry>, retriever: Retriever): Promise<PostScore> => {
  const entries = retriever.retrieve(post.text, glossary, post);
  try {
    const reply = await model.generate(requestFor(prompt, post, entries));
    return scorePost(post, glossary, entries, reply.text ?? "", reply.usage);
  } catch (error) {
    return { ...scorePost(post, glossary, entries, "", NO_USAGE), pass: false, error: (error as Error).message };
  }
};

const runCell = async (model: Model, prompt: Prompt, retriever: Retriever, posts: ReadonlyArray<Post>, glossary: ReadonlyArray<Entry>) => ({
  prompt: prompt.name,
  retriever: retriever.name,
  scores: await mapSequential(posts, (post) => answer(model, prompt, post, glossary, retriever)),
});

type Cell = Awaited<ReturnType<typeof runCell>>;

const distractorIds = (posts: ReadonlyArray<Post>) => new Set(posts.filter((post) => post.tags.includes("distractor")).map((post) => post.id));

const promptRows = (cells: ReadonlyArray<Cell>, posts: ReadonlyArray<Post>) => {
  const distractors = distractorIds(posts);
  return cells.map((cell) => {
    const all = totals(cell.scores);
    const empty = totals(cell.scores.filter((score) => distractors.has(score.postId)));
    return {
      prompt: cell.prompt,
      retriever: cell.retriever,
      "posts right": `${all.passed}/${all.posts}`,
      "wrong sense used": `${all.wrongUsed}/${all.wrongSupplied}`,
      "real swaps lost": `${all.requiredLost}/${all.requiredSupplied}`,
      "empty posts right": `${empty.passed}/${empty.posts}`,
      errors: all.errors,
    };
  });
};

const tokenRows = (cells: ReadonlyArray<Cell>) =>
  cells.map((cell) => {
    const all = totals(cell.scores);
    return { prompt: cell.prompt, retriever: cell.retriever, "input tokens": all.inputTokens, "output tokens": all.outputTokens, "thinking tokens": all.thinkingTokens, "posts right": `${all.passed}/${all.posts}` };
  });

const key = process.env.GROQ_API_KEY;
if (!key) throw new Error("GROQ_API_KEY is not set; put it in 03c-sense-prompt/.env");

const model = groqModel(key);
const posts = loadPosts();
const glossary = loadGlossaries().all;
const startedAt = new Date().toISOString();

const plan = PROMPTS.flatMap((prompt) => [hybridMatch, oracle].map((retriever) => ({ prompt, retriever })));
const promptCells = await mapSequential(plan, ({ prompt, retriever }) => runCell(model, prompt, retriever, posts, glossary));
console.log(`${model.name}, ${posts.length} posts, ${glossary.length} glossary entries`);
console.log("\nthe two prompts, scored in code against the labels");
console.table(promptRows(promptCells, posts));

const lookupCells = await mapSequential([exactUpTo(2), exactUpTo(4)], (retriever) => runCell(model, MUST_USE, retriever, posts, glossary));
console.log("\nprompt tokens with two and four word lookups (exact rule, must use prompt)");
console.table(tokenRows(lookupCells));

mkdirSync(new URL("../results/", import.meta.url), { recursive: true });
const file = new URL(`../results/${startedAt.replace(/[:.]/g, "-")}.json`, import.meta.url);
writeFileSync(file, JSON.stringify({ model: model.name, startedAt, prompts: PROMPTS, promptCells, lookupCells }, null, 2));
console.log(`\nsaved ${file.pathname}`);
