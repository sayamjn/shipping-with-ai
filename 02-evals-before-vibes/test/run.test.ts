import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runEval } from "../src/evaluate.ts";
import { parseFindings } from "../src/extract.ts";
import { lowerSchemaTypes } from "../src/groq.ts";
import { scriptedModel } from "../src/models.ts";
import { PROMPTS } from "../src/prompts.ts";
import { summaryRow } from "../src/report.ts";
import type { Model } from "../src/types.ts";

describe("offline eval run", () => {
  it("is labelled as a stand-in, not a model", () => {
    assert.equal(scriptedModel().name, "scripted (offline stand-in, not a real model)");
  });

  it("completes, passes every vibes case with both prompts, and shows v2 ahead of v1 on all cases", async () => {
    const run = await runEval(scriptedModel());
    const [v1, v2] = run.results;
    assert.deepEqual([v1.version, v2.version], ["v1", "v2"]);
    assert.deepEqual([v1.vibes.totals.casesPassed, v2.vibes.totals.casesPassed], [3, 3]);
    assert.ok(v2.all.totals.casesPassed > v1.all.totals.casesPassed);
    assert.ok(v2.all.totals.falsePositives < v1.all.totals.falsePositives);
    assert.ok(v2.all.totals.casesPassed < v2.all.totals.cases);
    assert.ok(v1.judge.calibration.judged > 0 && v1.judge.calibration.disagreements.length > 0);
    assert.match(summaryRow(v1)["all cases passed"], /^\d+\/24$/);
  });

  it("records a failed model call as an errored case instead of stopping the run", async () => {
    const failing: Model = { name: "down", generate: async () => Promise.reject(new Error("503")) };
    const run = await runEval(failing);
    assert.deepEqual(run.results.map((result) => [result.all.totals.errors, result.all.totals.casesPassed]), [[24, 0], [24, 0]]);
  });
});

describe("prompts", () => {
  it("keeps v1 identical to the workflow prompt in 01-agent-or-workflow", () => {
    assert.equal(PROMPTS.v1, "You read WhatsApp chats for Sayam. Return only what is waiting on him (someone asked him something) and what he promised. Copy the quote exactly from the message.");
  });
});

describe("model replies", () => {
  it("keeps well formed findings and drops the rest", () => {
    const text = JSON.stringify({ findings: [{ chatId: "c1", messageId: "m1", kind: "waiting_on_me", quote: "Hi" }, { chatId: "c1", kind: "maybe" }] });
    assert.deepEqual(parseFindings(text), [{ chatId: "c1", messageId: "m1", kind: "waiting_on_me", quote: "Hi", summary: "" }]);
    assert.deepEqual(parseFindings("not json"), []);
  });

  it("lowercases schema types for an OpenAI style API", () => {
    assert.deepEqual(lowerSchemaTypes({ type: "OBJECT", properties: { kind: { type: "STRING", enum: ["a"] } } }), { type: "object", properties: { kind: { type: "string", enum: ["a"] } } });
  });
});
