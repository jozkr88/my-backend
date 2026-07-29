import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateBrierScore,
  calculateExpectedCalibrationError,
  evaluateProbabilisticPlans,
  normalizeExperienceRows,
  predictNextStates,
  simulateTrajectory,
} from "./worldExperience.js";
import { buildCanonicalWorldState } from "./worldSimulator.js";

const transitions = [
  {
    action: "ball",
    nextStateKey: "meet_joz_flex_stage",
    target: "/neo/meet-joz",
  },
];

function initialState() {
  return buildCanonicalWorldState({
    appContext: {
      current_portal: "root",
      available_actions: ["ball"],
    },
  });
}

test("unseen transitions fall back to the symbolic model with normalized probability", () => {
  const outcomes = predictNextStates(initialState(), "ball", { transitions });

  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].probability, 1);
  assert.equal(outcomes[0].evidence, "symbolic_transition_fallback");
  assert.equal(outcomes[0].predictedState.portal, "meet_joz");
});

test("experience produces multiple probabilistic futures with normalized probabilities", () => {
  const outcomes = predictNextStates(initialState(), "ball", {
    transitions,
    experienceRows: [
      {
        state_key: "root",
        action_key: "ball",
        next_state_key: "meet_joz_flex_stage",
        next_portal: "meet_joz",
        next_stage: "vibe",
        attempts: 8,
        successes: 7,
      },
      {
        state_key: "root",
        action_key: "ball",
        next_state_key: "root",
        next_portal: "root",
        next_stage: "",
        attempts: 2,
        successes: 1,
      },
    ],
  });

  assert.equal(outcomes.length, 2);
  assert.ok(Math.abs(outcomes.reduce((sum, item) => sum + item.probability, 0) - 1) < 1e-9);
  assert.ok(outcomes.some((item) => item.predictedState.portal === "root"));
  assert.ok(outcomes.some((item) => item.predictedState.portal === "meet-joz"));
  assert.ok(outcomes.every((item) => item.confidence >= 0.4));
});

test("multi-step rollout propagates uncertainty without mutating the initial state", () => {
  const state = initialState();
  const result = simulateTrajectory(state, ["ball"], {
    transitions,
    experienceByAction: {
      ball: [
        {
          state_key: "root",
          action_key: "ball",
          next_state_key: "meet_joz_flex_stage",
          next_portal: "meet_joz",
          attempts: 5,
          successes: 5,
        },
        {
          state_key: "root",
          action_key: "ball",
          next_state_key: "root",
          next_portal: "root",
          attempts: 1,
          successes: 0,
        },
      ],
    },
  });

  assert.equal(state.portal, "root");
  assert.ok(result.branches.length >= 2);
  assert.ok(result.uncertainty > 0);
  assert.ok(result.successProbability > 0);
});

test("probabilistic plan evaluation remains shadow-only and deterministic", () => {
  const state = initialState();
  const plans = [{ actions: ["ball"], transitions }];
  const first = evaluateProbabilisticPlans(state, plans, "open Meet Joz", { transitions });
  const second = evaluateProbabilisticPlans(state, plans, "open Meet Joz", { transitions });

  assert.deepEqual(first, second);
  assert.equal(state.portal, "root");
  assert.equal(first[0].probabilisticSimulation.predictedState.portal, "meet_joz");
});

test("malformed historical rows are ignored safely", () => {
  const rows = normalizeExperienceRows([
    null,
    { action_key: "ball", attempts: "not-a-number" },
    { state_key: "root", action_key: "ball", attempts: 3, successes: 2 },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].attempts, 0);
  assert.equal(rows[1].successes, 2);
});

test("evaluation metrics expose Brier score and calibration error", () => {
  const predictions = [
    { probability: 0.9, outcome: true },
    { probability: 0.2, outcome: false },
    { probability: 0.7, outcome: true },
  ];

  assert.ok(calculateBrierScore(predictions) >= 0);
  assert.ok(calculateExpectedCalibrationError(predictions) >= 0);
});
