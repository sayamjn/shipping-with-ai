import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gradeCase, gradeTotals } from "../src/graders/code.ts";
import type { Case, Finding } from "../src/types.ts";
import { verifyFindings } from "../src/verify.ts";

const testCase: Case = {
  id: "sample",
  tags: ["question", "promise"],
  notes: "",
  chats: [
    {
      id: "c1",
      name: "Riya",
      unread: 0,
      muted: false,
      group: false,
      ignored: false,
      messages: [
        { id: "m1", from: "them", at: "2026-11-10T09:00:00+05:30", text: "Can you send the invoice?" },
        { id: "m2", from: "me", at: "2026-11-10T09:05:00+05:30", text: "I'll send it tonight" },
        { id: "m3", from: "them", at: "2026-11-10T09:06:00+05:30", text: "Thanks" },
      ],
    },
  ],
  expected: [{ chatId: "c1", messageId: "m2", kind: "i_promised" }],
};

const finding = (messageId: string, kind: Finding["kind"], quote: string): Finding => ({ chatId: "c1", messageId, kind, quote, summary: "" });

describe("code grader", () => {
  it("passes a case with exactly the expected findings", () => {
    const grade = gradeCase(testCase, [finding("m2", "i_promised", "I'll send it tonight")]);
    assert.equal(grade.pass, true);
    assert.deepEqual(grade.findings.map((item) => item.match), ["correct"]);
  });

  it("fails a case with an extra finding and counts it as a false positive", () => {
    const grade = gradeCase(testCase, [finding("m2", "i_promised", "I'll send it tonight"), finding("m1", "waiting_on_me", "Can you send the invoice?")]);
    assert.equal(grade.pass, false);
    assert.deepEqual(gradeTotals([grade]), { cases: 1, casesPassed: 0, expected: 1, found: 1, falsePositives: 1, missed: 0, wrongKind: 0, quoteFailures: 0, errors: 0 });
  });

  it("fails a case that returns nothing and counts the miss", () => {
    const grade = gradeCase(testCase, []);
    assert.equal(grade.pass, false);
    assert.equal(gradeTotals([grade]).missed, 1);
  });

  it("counts the right message with the wrong kind as wrong kind, not as a miss", () => {
    const grade = gradeCase(testCase, [finding("m2", "waiting_on_me", "I'll send it tonight")]);
    assert.equal(grade.pass, false);
    assert.deepEqual(grade.wrongKind, testCase.expected);
    const totals = gradeTotals([grade]);
    assert.deepEqual([totals.found, totals.wrongKind, totals.missed, totals.falsePositives], [0, 1, 0, 0]);
  });

  it("counts a repeated finding as a false positive", () => {
    const grade = gradeCase(testCase, [finding("m2", "i_promised", "I'll send it tonight"), finding("m2", "i_promised", "I'll send it tonight")]);
    assert.deepEqual(grade.findings.map((item) => item.match), ["correct", "unexpected"]);
  });

  it("fails a case whose finding is labelled right but quotes words that are not in the message", () => {
    const grade = gradeCase(testCase, [finding("m2", "i_promised", "I'll send it tomorrow")]);
    assert.equal(grade.pass, false);
    assert.equal(gradeTotals([grade]).quoteFailures, 1);
  });

  it("passes a case with nothing expected only when nothing is returned", () => {
    const empty: Case = { ...testCase, expected: [] };
    assert.equal(gradeCase(empty, []).pass, true);
    assert.equal(gradeCase(empty, [finding("m1", "waiting_on_me", "Can you send the invoice?")]).pass, false);
  });
});

describe("quote check", () => {
  it("keeps a real quote and flags an invented quote, an unknown message and the wrong sender", () => {
    const checked = verifyFindings(
      [
        finding("m2", "i_promised", "i'll   send it"),
        finding("m2", "i_promised", "I'll call you"),
        finding("m9", "i_promised", "I'll send it tonight"),
        finding("m1", "i_promised", "Can you send the invoice?"),
      ],
      testCase.chats,
    );
    assert.deepEqual(checked.map((item) => item.reason), [null, "quote not in message", "unknown message", "wrong sender for this kind"]);
  });
});
