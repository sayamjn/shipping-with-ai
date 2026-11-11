import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { caseProblems, loadCases, parseCases, vibesCases } from "../src/cases.ts";
import type { Case } from "../src/types.ts";

const cases = loadCases();

describe("labelled cases", () => {
  it("load without problems", () => {
    assert.ok(cases.length >= 20);
    assert.deepEqual(cases.flatMap(caseProblems), []);
  });

  it("have unique ids and tags on every case", () => {
    assert.equal(new Set(cases.map((testCase) => testCase.id)).size, cases.length);
    assert.ok(cases.every((testCase) => testCase.tags.length > 0 && testCase.notes.length > 0));
  });

  it("point every expected finding at a message in that case's chats", () => {
    cases.forEach((testCase) =>
      testCase.expected.forEach((item) => {
        const message = testCase.chats.find((chat) => chat.id === item.chatId)?.messages.find((candidate) => candidate.id === item.messageId);
        assert.ok(message, `${testCase.id} ${item.chatId}/${item.messageId}`);
        assert.equal(message.from, item.kind === "i_promised" ? "me" : "them", `${testCase.id} sender`);
      }),
    );
  });

  it("keep exactly three vibes cases", () => {
    assert.equal(vibesCases(cases).length, 3);
  });

  it("include cases where nothing is expected", () => {
    assert.ok(cases.filter((testCase) => testCase.expected.length === 0).length >= 5);
  });

  it("reject a label that points at a missing message", () => {
    const broken: Case = { ...cases[0], expected: [{ chatId: "c1", messageId: "m9", kind: "waiting_on_me" }] };
    assert.deepEqual(caseProblems(broken), [`${cases[0].id}: expected message c1/m9 missing`]);
    assert.throws(() => parseCases(`${JSON.stringify(cases[0])}\n${JSON.stringify(cases[0])}\n`), /duplicate case id/);
  });
});
