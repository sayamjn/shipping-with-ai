import assert from "node:assert/strict";
import { test } from "node:test";
import { FUZZY_THRESHOLD } from "../../03-rag-is-search-first/src/retrievers.ts";
import { loadGlossaries, loadPosts } from "../src/data.ts";
const { tuned, unseen, all } = loadGlossaries();
const posts = loadPosts();
const terms = new Set(all.map((entry) => entry.term));

test("the retrievers are the tuned ones, unchanged", () => {
  assert.equal(FUZZY_THRESHOLD, 0.75);
  assert.equal(tuned.length, 25);
});

test("no unseen term repeats a tuned term", () => {
  const tunedTerms = new Set(tuned.map((entry) => entry.term));
  assert.deepEqual(unseen.filter((entry) => tunedTerms.has(entry.term)), []);
});

test("every label names a glossary entry", () => {
  const unknown = posts.flatMap((post) => [...post.required, ...post.forbidden].filter((term) => !terms.has(term)).map((term) => `${post.id}: ${term}`));
  assert.deepEqual(unknown, []);
});

test("every unseen term is needed by at least one post", () => {
  const needed = new Set(posts.flatMap((post) => post.required));
  assert.deepEqual(unseen.filter((entry) => !needed.has(entry.term)).map((entry) => entry.term), []);
});

test("every forbidden unseen entry has a sense, and no post both needs and forbids it", () => {
  const unseenTerms = new Set(unseen.map((entry) => entry.term));
  const withSense = new Set(unseen.filter((entry) => entry.sense).map((entry) => entry.term));
  assert.deepEqual(posts.flatMap((post) => post.forbidden.filter((term) => unseenTerms.has(term) && !withSense.has(term))), []);
  assert.deepEqual(posts.filter((post) => post.forbidden.some((term) => post.required.includes(term))).map((post) => post.id), []);
});

test("post ids are unique", () => {
  assert.equal(new Set(posts.map((post) => post.id)).size, posts.length);
});
