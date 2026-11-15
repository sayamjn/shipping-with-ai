import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadGlossary, loadPosts } from "../src/data.ts";
import { gradeRetrieval } from "../src/metrics.ts";
import { exactMatch, fuzzyMatch, hybridMatch, normalisedMatch, oracle } from "../src/retrievers.ts";
import { lookupTerms, normaliseWord, similarity } from "../src/text.ts";

const glossary = loadGlossary();
const posts = loadPosts();
const post = (id: string) => posts.find((item) => item.id === id)!;
const terms = (retriever: typeof exactMatch, id: string) => retriever.retrieve(post(id).text, glossary, post(id)).map((entry) => entry.term);

describe("data", () => {
  it("labels only terms that exist in the glossary", () => {
    const known = new Set(glossary.map((entry) => entry.term));
    posts.forEach((item) => [...item.required, ...item.forbidden].forEach((term) => assert.ok(known.has(term), `${item.id}: ${term}`)));
  });

  it("uses made up target words that are not English terms in the glossary", () => {
    const words = glossary.flatMap((entry) => entry.word.split(" "));
    const termWords = new Set(glossary.flatMap((entry) => entry.term.split(" ")));
    words.forEach((word) => assert.ok(!termWords.has(word), word));
  });

  it("has 24 posts with unique ids", () => {
    assert.equal(posts.length, 24);
    assert.equal(new Set(posts.map((item) => item.id)).size, 24);
  });
});

describe("lookup terms, as in the Nagamese glossary step", () => {
  it("builds every one to four word phrase, dropping stop words, short terms and numbers", () => {
    const found = lookupTerms("Home delivery is free on every order above 500 rupees.");
    assert.ok(found.includes("home delivery") && found.includes("order") && found.includes("home delivery is free"));
    assert.ok(!found.includes("on") && !found.includes("500") && !found.includes("is"));
  });
});

describe("retrievers", () => {
  it("exact match finds phrases as written and misses plurals and typos", () => {
    assert.deepEqual(terms(exactMatch, "e1"), ["coffee", "cold coffee"]);
    assert.deepEqual(terms(exactMatch, "p1"), []);
    assert.deepEqual(terms(exactMatch, "t2"), []);
  });

  it("normalising recovers plurals and also pulls in the bread roll for rolling out", () => {
    assert.deepEqual(terms(normalisedMatch, "p1"), ["cookie"]);
    assert.ok(terms(normalisedMatch, "d2").includes("roll"));
    assert.ok(!terms(exactMatch, "d2").includes("roll"));
  });

  it("fuzzy matching recovers typos", () => {
    assert.ok(terms(fuzzyMatch, "t1").includes("chocolate cake"));
    assert.ok(terms(fuzzyMatch, "t4").includes("opening hours"));
  });

  it("no lexical retriever finds a synonym, and the oracle returns exactly the labels", () => {
    [exactMatch, normalisedMatch, fuzzyMatch, hybridMatch].forEach((retriever) => assert.ok(!terms(retriever, "s2").includes("takeaway")));
    assert.deepEqual(terms(oracle, "s1"), ["tea", "cookie"].sort((a, b) => glossary.findIndex((e) => e.term === a) - glossary.findIndex((e) => e.term === b)));
  });
});

describe("retrieval grade", () => {
  it("counts found, missed, extra and wrong sense entries", () => {
    const grade = gradeRetrieval(post("d2"), normalisedMatch.retrieve(post("d2").text, glossary, post("d2")));
    assert.deepEqual(grade.found, ["opening hours"]);
    assert.deepEqual(grade.wrongSense, ["roll"]);
    assert.equal(grade.complete, false);
  });
});

describe("text helpers", () => {
  it("normalises plurals and simple verb endings", () => {
    assert.deepEqual(["cookies", "sandwiches", "rolling", "baked", "glass"].map(normaliseWord), ["cookie", "sandwich", "roll", "bake", "glass"]);
  });

  it("scores identical text 1 and unrelated text near 0", () => {
    assert.equal(similarity("cake", "cake"), 1);
    assert.ok(similarity("cake", "tea") < 0.2);
  });
});
