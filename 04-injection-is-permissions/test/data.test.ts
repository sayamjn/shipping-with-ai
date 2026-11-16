import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadCases, loadOwner } from "../src/data.ts";
import { findIn } from "../src/grade.ts";
import { plainChat, taggedChat } from "../src/prompts.ts";
import { TECHNIQUES } from "../src/report.ts";

const cases = loadCases();
const owner = loadOwner();
const attacks = cases.filter((item) => item.goal !== "benign");
const benign = cases.filter((item) => item.goal === "benign");
const bodies = (item: (typeof cases)[number]) => item.messages.map((message) => message.body).join(" ");

describe("cases", () => {
  it("has 20 attacks and 6 benign chats with unique ids", () => {
    assert.equal(attacks.length, 20);
    assert.equal(benign.length, 6);
    assert.equal(new Set(cases.map((item) => item.id)).size, 26);
  });

  it("splits attacks evenly by who typed the command and covers every technique", () => {
    assert.equal(attacks.filter((item) => item.typedBy === "owner").length, 10);
    TECHNIQUES.forEach((tag) => assert.ok(attacks.filter((item) => item.tags.includes(tag)).length >= 2, tag));
    attacks.forEach((item) => assert.ok(item.tags.every((tag) => (TECHNIQUES as ReadonlyArray<string>).includes(tag)), item.id));
  });

  it("never puts a canary in the chat, so a model that only repeats the chat cannot trip one", () => {
    attacks.forEach((item) => {
      assert.ok(item.canaries.length > 0, item.id);
      [bodies(item), plainChat(item), taggedChat(item)].forEach((text) => assert.deepEqual(findIn(text, item.canaries), [], item.id));
    });
  });

  it("uses only owner secrets as leak canaries, and no secret appears in any chat", () => {
    attacks.filter((item) => item.goal === "leak").forEach((item) => item.canaries.forEach((canary) => assert.ok(owner.secrets.includes(canary), `${item.id}: ${canary}`)));
    cases.forEach((item) => assert.deepEqual(findIn(plainChat(item), owner.secrets), [], item.id));
  });

  it("hides every secret in the owner's notes", () => {
    owner.secrets.filter((secret) => secret !== "Hearth and Hops").forEach((secret) => assert.ok(findIn(owner.notes.join("\n"), [secret]).length, secret));
  });

  it("types every benign command as the owner, with facts the chat actually contains", () => {
    benign.forEach((item) => {
      assert.equal(item.typedBy, "owner");
      assert.ok(item.facts.length >= 2, item.id);
      item.facts.forEach((alternatives) => assert.ok(findIn(bodies(item), alternatives).length, `${item.id}: ${alternatives[0]}`));
    });
  });
});
