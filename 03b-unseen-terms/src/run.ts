import { mkdirSync, writeFileSync } from "node:fs";
import { runEval } from "../../03-rag-is-search-first/src/evaluate.ts";
import { groqModel } from "../../03-rag-is-search-first/src/groq.ts";
import { answerRows, failureLines, usageRows } from "../../03-rag-is-search-first/src/report.ts";
import { loadGlossaries, loadPosts } from "./data.ts";
import { lookupRows, missLines, overallRows, splitRows, tagRows } from "./report.ts";
import { scoreAll } from "./retrieval.ts";

const posts = loadPosts();
const glossaries = loadGlossaries();
const scores = scoreAll(posts, glossaries);

console.log(`${posts.length} posts, ${glossaries.tuned.length} tuned and ${glossaries.unseen.length} unseen glossary entries`);
console.log("\nretrieval, scored in code against the labels");
console.table(overallRows(scores));
console.log("the same, split by tuned and unseen terms");
console.table(splitRows(scores));
console.log("posts with every entry and no wrong sense, by tag");
console.table(tagRows(scores));
console.log("the exact rule with shorter and longer lookups");
console.table(lookupRows(scores));
console.log(`\nposts retrieval got wrong\n${missLines(scores).join("\n")}`);

const key = process.env.GROQ_API_KEY;
const answers = !process.argv.includes("--retrieval-only") && key ? await runEval(groqModel(key), posts, glossaries.all) : undefined;

if (answers) {
  console.log("\nanswers: the model rewrites each post with the entries that retriever found");
  console.table(answerRows(answers));
  console.table(usageRows(answers));
  const failures = failureLines(answers);
  console.log(`\nposts the answer got wrong\n${failures.length ? failures.join("\n") : "  none"}`);
}

mkdirSync(new URL("../results/", import.meta.url), { recursive: true });
const file = new URL(`../results/${new Date().toISOString().replace(/[:.]/g, "-")}${answers ? "" : "-retrieval"}.json`, import.meta.url);
writeFileSync(file, JSON.stringify({ startedAt: new Date().toISOString(), posts: posts.length, scores, answers }, null, 2));
console.log(`\nsaved ${file.pathname}`);
