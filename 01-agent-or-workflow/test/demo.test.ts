import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { runAgent } from "../src/agent.ts";
import { scriptedModel } from "../src/models.ts";
import { pickCandidates, scoreChat } from "../src/rank.ts";
import type { Chat, Model } from "../src/types.ts";
import { verifyFindings } from "../src/verify.ts";
import { runWorkflow } from "../src/workflow.ts";

const chats: ReadonlyArray<Chat> = JSON.parse(readFileSync(new URL("../data/chats.json", import.meta.url), "utf8"));
const TODAY = "2026-11-10";

describe("ranking in plain code", () => {
  it("sends questions and promises, and leaves muted and quiet chats out", () => {
    const picked = pickCandidates(chats, TODAY).map((ranked) => ranked.chat.id);
    assert.ok(picked.includes("c01") && picked.includes("c02") && picked.includes("c11"));
    assert.ok(!picked.includes("c03") && !picked.includes("c06") && !picked.includes("c09"));
  });

  it("explains every score", () => {
    assert.deepEqual(scoreChat(chats[1], TODAY).reasons, ["I promised something"]);
  });
});

describe("quote check", () => {
  it("keeps a real quote and flags an invented one", () => {
    const checked = verifyFindings(
      [
        { chatId: "c02", messageId: "m2", kind: "i_promised", quote: "I'll fix the link", summary: "" },
        { chatId: "c02", messageId: "m2", kind: "i_promised", quote: "I'll call you at 5", summary: "" },
        { chatId: "c01", messageId: "m2", kind: "i_promised", quote: "Can you send me an ETA today?", summary: "" },
      ],
      chats,
    );
    assert.deepEqual(checked.map((finding) => finding.reason), [null, "quote not in message", "wrong sender for this kind"]);
  });
});

describe("both approaches, offline", () => {
  it("the workflow makes one model call", async () => {
    const result = await runWorkflow(chats, scriptedModel(chats), TODAY);
    assert.equal(result.trace.filter((step) => step.kind === "model").length, 1);
    assert.ok(result.findings.length > 0 && result.findings.every((finding) => finding.verified));
  });

  it("the agent makes a model call for every step it takes", async () => {
    const result = await runAgent(chats, scriptedModel(chats));
    const modelCalls = result.trace.filter((step) => step.kind === "model").length;
    const toolCalls = result.trace.filter((step) => step.kind === "tool").length;
    assert.equal(result.stoppedBy, "done");
    assert.equal(modelCalls, toolCalls + 1);
  });

  it("the agent stops at the step limit instead of looping forever", async () => {
    const looping: Model = { name: "loop", generate: async () => ({ toolCalls: [{ name: "list_chats", args: {} }], usage: { inputTokens: 1, outputTokens: 1 } }) };
    const result = await runAgent(chats, looping, 4);
    assert.equal(result.stoppedBy, "step_limit");
  });
});
