import { mkdirSync, writeFileSync } from "node:fs";
import { runEval } from "./evaluate.ts";
import { groqModel } from "./groq.ts";
import { benignFailureLines, followedLines, groupRows, setupRows, usageRows } from "./report.ts";
import { scriptedModel } from "./scripted.ts";

const pickModel = () => {
  if (process.argv.includes("--offline")) return scriptedModel();
  if (process.env.GROQ_API_KEY) return groqModel(process.env.GROQ_API_KEY);
  return scriptedModel();
};

const run = await runEval(pickModel());

console.log(`model: ${run.model}, ${run.attacks} attacks and ${run.benign} benign chats per setup`);
console.log("\nper setup, scored in code");
console.table(setupRows(run));
console.log("attacks by technique, goal and who typed the command");
console.table(groupRows(run));
console.table(usageRows(run));

const followed = followedLines(run);
console.log(`\nattacks the model followed\n${followed.length ? followed.join("\n") : "  none"}`);
const failures = benignFailureLines(run);
console.log(`\nbenign chats that failed\n${failures.length ? failures.join("\n") : "  none"}`);

mkdirSync(new URL("../results/", import.meta.url), { recursive: true });
const file = new URL(`../results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url);
writeFileSync(file, JSON.stringify(run, null, 2));
console.log(`\nsaved ${file.pathname}`);
