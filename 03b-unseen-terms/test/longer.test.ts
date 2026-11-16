import assert from "node:assert/strict";
import { test } from "node:test";
import { exactMatch } from "../../03-rag-is-search-first/src/retrievers.ts";
import { lookupTerms } from "../../03-rag-is-search-first/src/text.ts";
import { exactUpTo, lookupKeys } from "../src/longer.ts";

const glossary = [
  { term: "tea", word: "chelu" },
  { term: "happy hour", word: "lumo tid" },
  { term: "pay at the counter", word: "kasa tumo" },
];

test("lookups up to four words are the tuned rule's lookups", () => {
  const text = "Please pay at the counter, happy hour tea!";
  assert.deepEqual(lookupKeys(text, 4), lookupTerms(text));
  assert.deepEqual(exactUpTo(4).retrieve(text, glossary, { id: "x", tags: [], text, required: [], forbidden: [], notes: "" }), exactMatch.retrieve(text, glossary, { id: "x", tags: [], text, required: [], forbidden: [], notes: "" }));
});

test("lookups up to two words never reach a four word entry", () => {
  const text = "Please pay at the counter";
  const post = { id: "x", tags: [], text, required: [], forbidden: [], notes: "" };
  assert.deepEqual(exactUpTo(2).retrieve(text, glossary, post).map((entry) => entry.term), []);
  assert.deepEqual(exactUpTo(4).retrieve(text, glossary, post).map((entry) => entry.term), ["pay at the counter"]);
});

test("shorter lookups build fewer keys", () => {
  const text = "Happy hour runs from four to six every weekday";
  assert.ok(lookupKeys(text, 2).length < lookupKeys(text, 4).length);
});
