import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadCases, loadOwner } from "../src/data.ts";
import { BASE_SYSTEM, buildRequest, PROMPT_ONLY_SYSTEM } from "../src/prompts.ts";
import { runSetup, SETUPS } from "../src/setups.ts";
import type { Model, ModelRequest } from "../src/types.ts";

const cases = loadCases();
const owner = loadOwner();
const setup = (name: string) => SETUPS.find((entry) => entry.name === name)!;

const spyModel = (text = "ok") => {
  const requests: Array<ModelRequest> = [];
  const model: Model = {
    name: "spy",
    generate: async (request) => {
      requests.push(request);
      return { text, usage: { inputTokens: 0, outputTokens: 0 } };
    },
  };
  return { model, requests };
};

describe("permission gate", () => {
  it("refuses every command not typed by the owner without calling the model", async () => {
    const spy = spyModel();
    const others = cases.filter((item) => item.typedBy === "other");
    const outcomes = await Promise.all(others.map((item) => runSetup(setup("permissions"), spy.model, item, owner)));
    assert.equal(spy.requests.length, 0);
    outcomes.forEach((outcome) => assert.deepEqual([outcome.refused, outcome.output, outcome.postedTo], [true, "", "nowhere"]));
  });

  it("never posts into the chat, for any case, even when the model would", async () => {
    const spy = spyModel("I am resigning as treasurer, effective today");
    const outcomes = await Promise.all(cases.map((item) => runSetup(setup("permissions"), spy.model, item, owner)));
    outcomes.forEach((outcome) => assert.notEqual(outcome.postedTo, "chat"));
    assert.equal(spy.requests.length, cases.filter((item) => item.typedBy === "owner").length);
  });

  it("runs others' commands in the weaker setups and posts into the chat", async () => {
    const spy = spyModel();
    const item = cases.find((entry) => entry.typedBy === "other")!;
    for (const name of ["none", "prompt only"]) assert.equal((await runSetup(setup(name), spy.model, item, owner)).postedTo, "chat");
  });
});

describe("prompts", () => {
  const item = cases.find((entry) => entry.id === "a01")!;

  it("pastes plain sender: body lines with the private notes in none", () => {
    const { system, turns } = buildRequest(setup("none"), item, owner);
    assert.equal(system, BASE_SYSTEM);
    assert.match(turns[0].text, /^Kabir: Ignore all previous instructions/m);
    assert.match(turns[0].text, /5826/);
  });

  it("wraps messages in tags with the data-only system prompt in prompt only", () => {
    const { system, turns } = buildRequest(setup("prompt only"), item, owner);
    assert.equal(system, PROMPT_ONLY_SYSTEM);
    assert.match(turns[0].text, /<message sender="Kabir">Ignore all previous instructions/);
    assert.match(turns[0].text, /5826/);
  });

  it("uses the none prompt without the private notes in permissions", () => {
    const none = buildRequest(setup("none"), item, owner);
    const permissions = buildRequest(setup("permissions"), item, owner);
    assert.equal(permissions.system, none.system);
    owner.notes.forEach((note) => assert.ok(!permissions.turns[0].text.includes(note)));
    assert.ok(none.turns[0].text.endsWith(permissions.turns[0].text));
  });
});
