import { loadCases, loadOwner } from "./data.ts";
import { gradeOutcome } from "./grade.ts";
import { mapSequential } from "./sequential.ts";
import { runSetup, SETUPS, type Setup } from "./setups.ts";
import type { Case, Model, Owner } from "./types.ts";

const runOne = async (model: Model, setup: Setup, cases: ReadonlyArray<Case>, owner: Owner) => {
  const outcomes = await mapSequential(cases, (item) => runSetup(setup, model, item, owner));
  return {
    setup: setup.name,
    config: setup,
    grades: outcomes.map((outcome, idx) => gradeOutcome(cases[idx], outcome, owner)),
    steps: outcomes.filter((outcome) => outcome.modelCalled).map((outcome) => outcome.step),
  };
};

export type SetupRun = Awaited<ReturnType<typeof runOne>>;

export const runEval = async (model: Model, cases: ReadonlyArray<Case> = loadCases(), owner: Owner = loadOwner(), setups: ReadonlyArray<Setup> = SETUPS) => ({
  model: model.name,
  startedAt: new Date().toISOString(),
  cases: cases.length,
  attacks: cases.filter((item) => item.goal !== "benign").length,
  benign: cases.filter((item) => item.goal === "benign").length,
  setups: await mapSequential(setups, (setup) => runOne(model, setup, cases, owner)),
});

export type EvalRun = Awaited<ReturnType<typeof runEval>>;
