import assert from "node:assert/strict";
import { test } from "node:test";
import { MAY_SKIP, MUST_USE, requestFor } from "../src/prompts.ts";
import { scorePost, totals } from "../src/score.ts";

const glossary = [
  { term: "jam", word: "murla", sense: "fruit jam" },
  { term: "toast", word: "brenka", sense: "toasted bread" },
];
const usage = { inputTokens: 10, outputTokens: 5, thinkingTokens: 2 };
const post = (required: ReadonlyArray<string>, forbidden: ReadonlyArray<string>, text = "x") => ({ id: "p", tags: [], text, required, forbidden, notes: "" });

test("a wrong sense entry that was supplied and used counts as used", () => {
  const score = scorePost(post([], ["jam"]), glossary, [glossary[0]], "Stuck in a traffic murla?", usage);
  assert.deepEqual([score.wrongSupplied, score.wrongUsed, score.pass], [1, 1, false]);
});

test("a wrong sense entry left out of the rewrite counts as avoided", () => {
  const score = scorePost(post([], ["jam"]), glossary, [glossary[0]], "Stuck in a traffic jam?", usage);
  assert.deepEqual([score.wrongSupplied, score.wrongUsed, score.pass], [1, 0, true]);
  assert.equal(totals([score]).wrongAvoided, 1);
});

test("a supplied required entry missing from the rewrite counts as lost", () => {
  const score = scorePost(post(["toast"], []), glossary, [glossary[1]], "Butter toast and tea", usage);
  assert.deepEqual([score.requiredSupplied, score.requiredLost, score.pass], [1, 1, false]);
});

test("a required entry retrieval never supplied is not counted as lost", () => {
  const score = scorePost(post(["toast"], []), glossary, [], "Butter toast and tea", usage);
  assert.deepEqual([score.requiredSupplied, score.requiredLost], [0, 0]);
});

test("both prompts send the same glossary block and post", () => {
  const sample = post([], [], "Raise a toast");
  const [must, skip] = [MUST_USE, MAY_SKIP].map((prompt) => requestFor(prompt, sample, glossary).turns[0].text);
  const body = (text: string) => text.slice(text.indexOf("\n") + 1);
  assert.equal(body(must), body(skip));
  assert.notEqual(MUST_USE.system, MAY_SKIP.system);
});

test("totals add tokens across posts", () => {
  const score = scorePost(post([], []), glossary, [], "x", usage);
  const sum = totals([score, score]);
  assert.deepEqual([sum.inputTokens, sum.outputTokens, sum.thinkingTokens], [20, 10, 4]);
});
