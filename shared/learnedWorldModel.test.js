import test from "node:test";
import assert from "node:assert/strict";

import {
  assignTrajectorySplit,
  buildLearningExamples,
  evaluateLearnedWorldModel,
  predictLearnedNextStates,
  trainLearnedWorldModel,
  validateLearnedWorldModel,
} from "./learnedWorldModel.js";

function row(sessionId, nextPortal, nextStateKey, action = "ball") {
  return {
    trajectory_id: `trajectory-${sessionId}`,
    session_id: sessionId,
    state_before: { portal: "root", currentStateKey: "root", visibleEntityIds: ["root_gold_pill"] },
    proposed_action: action,
    observed_state: { portal: nextPortal, currentStateKey: nextStateKey, visibleEntityIds: [] },
    classification: "valid",
  };
}

test("session splitting keeps a session in exactly one partition", () => {
  const split = assignTrajectorySplit("session-a");
  assert.ok(["train", "validation", "test"].includes(split));
  assert.equal(assignTrajectorySplit("session-a"), split);
});

test("learner trains a structured transition distribution and predicts observed futures", () => {
  const rows = [
    row("train-a", "meet-joz", "meet_joz_flex_stage"),
    row("train-b", "meet-joz", "meet_joz_flex_stage"),
    row("train-c", "root", "root"),
  ];
  const model = trainLearnedWorldModel(rows, { trainRatio: 1, validationRatio: 0 });
  assert.equal(validateLearnedWorldModel(model), true);
  const predictions = predictLearnedNextStates(model, rows[0].state_before, "ball");
  assert.equal(predictions[0].evidence, "learned_transition_model");
  assert.equal(predictions[0].predictedState.portal, "meet-joz");
  assert.ok(predictions[0].probability > 0.4);
  assert.equal(predictions[0].learned, true);
});

test("learner has no hallucinated prediction for an unseen state-action pair", () => {
  const model = trainLearnedWorldModel([row("train-a", "meet-joz", "meet_joz_flex_stage")], {
    trainRatio: 1,
    validationRatio: 0,
  });
  assert.deepEqual(
    predictLearnedNextStates(model, { portal: "maxx", currentStateKey: "unknown" }, "ball"),
    []
  );
});

test("evaluation reports held-out coverage and does not overclaim tiny samples", () => {
  const rows = [
    row("session-train", "meet-joz", "meet_joz_flex_stage"),
    row("session-test", "meet-joz", "meet_joz_flex_stage"),
  ];
  const model = trainLearnedWorldModel(rows, { trainRatio: 0.5, validationRatio: 0 });
  const report = evaluateLearnedWorldModel(model, rows, { minimumSampleCount: 10 });
  assert.equal(report.evaluationType, "learned_structured_transition_model");
  assert.equal(report.meaningful, false);
  assert.ok(report.sampleCount >= 0);
});

test("learning examples exclude synthetic and invalid records by default", () => {
  const examples = buildLearningExamples([
    row("valid", "meet-joz", "next"),
    { ...row("synthetic", "meet-joz", "next"), is_synthetic: true },
    { ...row("invalid", "meet-joz", "next"), classification: "invalid_action" },
  ]);
  assert.equal(examples.length, 1);
});
