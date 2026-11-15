import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answerRequest, gradeAnswer } from "../src/answer.ts";
import { loadGlossary, loadPosts } from "../src/data.ts";
import { runEval } from "../src/evaluate.ts";
import { answerRows, retrievalRows } from "../src/report.ts";
import { scriptedModel } from "../src/scripted.ts";
import type { Model } from "../src/types.ts";

const glossary = loadGlossary();
const posts = loadPosts();
const post = (id: string) => posts.find((item) => item.id === id)!;

describe("answer grade", () => {
  it("passes only when every needed word is present and no wrong sense word is", () => {
    assert.equal(gradeAnswer(post("e1"), glossary, "Try our frosk mavi this weekend.").pass, true);
    assert.deepEqual(gradeAnswer(post("e1"), glossary, "Try our cold mavi this weekend.").missingWords, ["frosk mavi"]);
    assert.deepEqual(gradeAnswer(post("d1"), glossary, "Save the zimbo: our anniversary is on the 12th.").wrongWords, ["zimbo"]);
  });

  it("accepts a plural ending on the made up word but not a misspelling", () => {
    assert.equal(gradeAnswer(post("p1"), glossary, "Fresh dorpas come out of the oven at four.").pass, true);
    assert.equal(gradeAnswer(post("e5"), glossary, "davra velt is free on every tekla above 500 rupees.").pass, false);
  });

  it("shows the model only the retrieved entries", () => {
    const text = answerRequest(post("e1"), [glossary[1]]).turns[0].text;
    assert.match(text, /- cold coffee → frosk mavi/);
    assert.doesNotMatch(text, /chelu/);
  });
});

describe("offline run", () => {
  it("is labelled as a stand-in and scores retrieval before any answer", async () => {
    const run = await runEval(scriptedModel());
    assert.equal(run.model, "scripted (offline stand-in, not a real model)");
    const rows = retrievalRows(run);
    assert.deepEqual(rows.map((row) => row.retriever), ["exact", "normalised", "fuzzy", "normalised + fuzzy", "oracle (labels)"]);
    assert.equal(rows[0]["posts with every entry and no wrong sense"], "10/24");
    assert.equal(rows[4]["posts with every entry and no wrong sense"], "24/24");
    const [exact] = answerRows(run);
    assert.equal(exact["right when retrieval had a gap"], "0/14");
  });

  it("records a failed model call as an errored post instead of stopping the run", async () => {
    const failing: Model = { name: "down", generate: async () => Promise.reject(new Error("503")) };
    const run = await runEval(failing);
    assert.deepEqual(answerRows(run).map((row) => row.errors), [24, 24, 24]);
  });
});
