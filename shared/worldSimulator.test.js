import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCanonicalWorldState,
  buildPredictionTrace,
  chooseWorldPlan,
  compareWorldStates,
  evaluateWorldPlans,
  simulateAction,
  simulatePlan,
} from "./worldSimulator.js";

const transitions = [
  {
    action: "brain",
    nextStateKey: "brain_entry",
    target: "/neo/maxx",
    awareness: "Entering the Brain.",
  },
  {
    action: "ball",
    nextStateKey: "meet_joz_flex_stage",
    target: "/neo/meet-joz",
    awareness: "Opening Meet Joz.",
  },
];

test("world transitions are pure and produce a predicted state", () => {
  const initial = buildCanonicalWorldState({
    appContext: {
      current_portal: "root",
      available_actions: ["brain", "ball"],
    },
  });

  const result = simulateAction(initial, "ball", { transitions });

  assert.equal(result.valid, true);
  assert.equal(result.predictedState.portal, "meet_joz");
  assert.equal(result.predictedState.currentStateKey, "meet_joz_flex_stage");
  assert.equal(initial.portal, "root");
  assert.equal(initial.lastAction, null);
  assert.equal(result.expectedEffects[0].type, "navigate");
});

test("prediction traces expose learned candidates without changing execution metadata", () => {
  const trace = buildPredictionTrace({
    trajectoryId: "trace-learned",
    initialState: { portal: "root" },
    learnedTransitionModel: {
      enabled: true,
      loaded: true,
      modelVersion: "learned-structured-transition-v1",
      candidates: [{
        action: "brain",
        predictedState: { portal: "maxx" },
        probability: 0.8,
        confidence: 0.5,
        observations: 12,
        evidence: "learned_transition_model",
        learned: true,
        modelVersion: "learned-structured-transition-v1",
      }],
    },
  });

  assert.equal(trace.learnedTransitionModel.loaded, true);
  assert.equal(trace.learnedTransitionModel.candidates[0].action, "brain");
  assert.equal(trace.selected, null);
});

test("invalid actions are simulated as violations without mutating state", () => {
  const initial = buildCanonicalWorldState({
    appContext: {
      current_portal: "root",
      available_actions: ["brain"],
    },
  });

  const result = simulateAction(initial, "ball", { transitions });

  assert.equal(result.valid, false);
  assert.deepEqual(result.violations, ["ACTION_NOT_ALLOWED"]);
  assert.equal(result.predictedState.portal, "root");
});

test("the planner evaluates multiple futures and selects the relevant valid plan", () => {
  const initial = buildCanonicalWorldState({
    appContext: {
      current_portal: "root",
      available_actions: ["brain", "ball"],
    },
  });
  const candidates = [
    { actions: ["brain"], transitions },
    { actions: ["ball"], transitions },
  ];

  const evaluated = evaluateWorldPlans(initial, candidates, "open Meet Joz");
  const selected = chooseWorldPlan(initial, candidates, "open Meet Joz");

  assert.equal(evaluated.length, 2);
  assert.deepEqual(selected.plan.actions, ["ball"]);
  assert.equal(selected.simulation.valid, true);
});

test("prediction comparison exposes observed state differences", () => {
  const predicted = buildCanonicalWorldState({
    appContext: { current_portal: "meet_joz" },
  });
  const observed = buildCanonicalWorldState({
    appContext: { current_portal: "maxx" },
  });

  const comparison = compareWorldStates(predicted, observed);

  assert.equal(comparison.matches, false);
  assert.ok(comparison.differences.some((difference) => difference.field === "portal"));
});

test("multi-step rollouts stop at the first invalid action", () => {
  const initial = buildCanonicalWorldState({
    appContext: {
      current_portal: "root",
      available_actions: ["ball"],
    },
  });
  const rollout = simulatePlan(initial, ["ball", "brain"], { transitions });

  assert.equal(rollout.valid, false);
  assert.equal(rollout.trajectory.length, 2);
  assert.deepEqual(rollout.violations, ["ACTION_NOT_ALLOWED"]);
});
