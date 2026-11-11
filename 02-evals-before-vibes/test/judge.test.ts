import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calibrate, parseVerdict, type JudgeVerdict } from "../src/graders/judge.ts";

const verdict = (messageId: string, kind: JudgeVerdict["kind"], judged: JudgeVerdict["verdict"], caseId = "a"): JudgeVerdict => ({
  caseId,
  chatId: "c1",
  messageId,
  kind,
  quote: "",
  verdict: judged,
  reason: "",
});

const labels = [
  { id: "a", expected: [{ chatId: "c1", messageId: "m1", kind: "waiting_on_me" as const }] },
  { id: "b", expected: [] },
];

describe("judge calibration", () => {
  it("counts agreement with the labels and lists each disagreement", () => {
    const result = calibrate(
      [
        verdict("m1", "waiting_on_me", "pass"),
        verdict("m1", "i_promised", "pass"),
        verdict("m2", "waiting_on_me", "fail"),
        verdict("m1", "waiting_on_me", "fail", "b"),
      ],
      labels,
    );
    assert.deepEqual([result.judged, result.agreed, result.notJudged], [4, 3, 0]);
    assert.deepEqual([result.judgePassedLabelsRejected, result.judgeFailedLabelsAccepted], [1, 0]);
    assert.deepEqual(result.disagreements.map((item) => [item.messageId, item.kind, item.labelsSay]), [["m1", "i_promised", "incorrect"]]);
  });

  it("flags a judge that rejects a labelled finding", () => {
    const result = calibrate([verdict("m1", "waiting_on_me", "fail")], labels);
    assert.deepEqual([result.agreed, result.judgeFailedLabelsAccepted], [0, 1]);
  });

  it("leaves findings the judge could not judge out of the agreement count", () => {
    const result = calibrate([verdict("m1", "waiting_on_me", "not_judged"), verdict("m1", "waiting_on_me", "pass")], labels);
    assert.deepEqual([result.judged, result.agreed, result.notJudged], [1, 1, 1]);
  });

  it("reads a verdict and refuses anything that is not pass or fail", () => {
    assert.deepEqual(parseVerdict('{"verdict":"fail","reason":"Statement only."}'), { verdict: "fail", reason: "Statement only." });
    assert.equal(parseVerdict('{"verdict":"maybe"}').verdict, "not_judged");
    assert.equal(parseVerdict("not json").verdict, "not_judged");
  });
});
