import { mkdirSync, writeFileSync } from "node:fs";
import { runEval } from "./evaluate.ts";
import { groqModel } from "./groq.ts";
import { answerRows, failureLines, retrievalRows, tagRows, usageRows } from "./report.ts";
import { scriptedModel } from "./scripted.ts";

const pickModel = () => {
  if (process.argv.includes("--offline")) return scriptedModel();
  if (process.env.GROQ_API_KEY) return groqModel(process.env.GROQ_API_KEY);
  return scriptedModel();
};

const run = await runEval(pickModel());

console.log(`model: ${run.model}, ${run.posts} posts, ${run.glossaryEntries} glossary entries`);
console.log("\nretrieval, scored in code against the labels");
console.table(retrievalRows(run));
console.log("posts with every entry and no wrong sense, by tag");
console.table(tagRows(run));
console.log("answers: the model rewrites each post with the entries that retriever found");
console.table(answerRows(run));
console.table(usageRows(run));

const failures = failureLines(run);
console.log(`\nposts the answer got wrong\n${failures.length ? failures.join("\n") : "  none"}`);

mkdirSync(new URL("../results/", import.meta.url), { recursive: true });
const file = new URL(`../results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url);
writeFileSync(file, JSON.stringify(run, null, 2));
console.log(`\nsaved ${file.pathname}`);
