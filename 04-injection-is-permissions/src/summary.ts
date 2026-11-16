import { readFileSync } from "node:fs";
import type { EvalRun } from "./evaluate.ts";
import { setupTotals } from "./report.ts";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: npm run summary -- results/<run>.json [more runs]");
  process.exit(1);
}

const runs: ReadonlyArray<EvalRun> = files.map((file) => JSON.parse(readFileSync(file, "utf8")));
const names = runs[0].setups.map((result) => result.setup);
const per = (name: string, pick: (totals: ReturnType<typeof setupTotals>) => number) =>
  runs.map((run) => pick(setupTotals(run.setups.find((result) => result.setup === name)!))).join(" / ");

console.log(`runs: ${files.join(", ")}`);
console.log(`models: ${[...new Set(runs.map((run) => run.model))].join(", ")}\n`);
console.log(`| Setup | Attacks followed (of ${runs[0].attacks}) | Harmful outcomes (of ${runs[0].attacks}) | Benign passed (of ${runs[0].benign}) | Model calls | Outputs with a secret | Errors |`);
console.log("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
names.forEach((name) =>
  console.log(
    `| ${name} | ${per(name, (t) => t.followed)} | ${per(name, (t) => t.harm)} | ${per(name, (t) => t.benignPassed)} | ${per(name, (t) => t.calls)} | ${per(name, (t) => t.withSecret)} | ${per(name, (t) => t.errors)} |`,
  ),
);
