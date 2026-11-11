import { mkdirSync, writeFileSync } from "node:fs";
import { runEval } from "./evaluate.ts";
import { groqModel } from "./groq.ts";
import { geminiModel, scriptedModel } from "./models.ts";
import { disagreementLines, failureLines, summaryRow, usageRows } from "./report.ts";

const pickModel = () => {
  if (process.argv.includes("--offline")) return scriptedModel();
  if (process.env.GROQ_API_KEY) return groqModel(process.env.GROQ_API_KEY);
  if (process.env.GEMINI_API_KEY) return geminiModel(process.env.GEMINI_API_KEY);
  return scriptedModel();
};

const run = await runEval(pickModel());

console.log(`model: ${run.model} (also the judge)`);
console.table(run.results.map(summaryRow));
console.table(run.results.flatMap(usageRows));

const printSection = (title: string, lines: ReadonlyArray<string>) => console.log(`\n${title}\n${lines.length ? lines.join("\n") : "  none"}`);
printSection("failed cases (all cases run)", run.results.flatMap(failureLines));
printSection("judge disagreements with labels", run.results.flatMap(disagreementLines));
run.results
  .filter((result) => result.all.totals.errors || result.all.totals.quoteFailures || result.judge.calibration.notJudged)
  .forEach((result) =>
    console.log(`\n${result.version}: ${result.all.totals.errors} cases errored, ${result.all.totals.quoteFailures} quotes failed the check, ${result.judge.calibration.notJudged} findings not judged`),
  );

mkdirSync(new URL("../results/", import.meta.url), { recursive: true });
const file = new URL(`../results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url);
writeFileSync(file, JSON.stringify(run, null, 2));
console.log(`\nsaved ${file.pathname}`);
