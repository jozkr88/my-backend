import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPrivacySafeDatasetRecord,
  evaluatePersistedTrajectories,
} from "./world-model-dataset.mjs";

test("evaluation separates valid, partial, and synthetic records", () => {
  const report = evaluatePersistedTrajectories([
    {
      trajectory_id: "one",
      session_id: "same-session",
      classification: "valid",
      state_before: { portal: "root" },
      symbolic_prediction: { predictedState: { portal: "meet-joz", stage: "vibe" } },
      observed_state: { portal: "meet-joz", stage: "vibe" },
    },
    { trajectory_id: "two", classification: "partial" },
    { trajectory_id: "three", classification: "synthetic", is_synthetic: true },
  ], { minimumSampleCount: 1 });

  assert.equal(report.totalRecords, 3);
  assert.equal(report.validRecords, 1);
  assert.equal(report.excludedRecords, 1);
  assert.equal(report.metrics.nextStateAccuracy.value, 1);
});

test("dataset export removes identifiers and prompt-like fields", () => {
  const exported = buildPrivacySafeDatasetRecord({
    trajectory_id: "trajectory-direct-id",
    session_id: "session-direct-id",
    classification: "valid",
    state_before: { userContext: { email: "person@example.com" }, portal: "root" },
    symbolic_prediction: { predictedState: { portal: "meet-joz" }, input: "secret prompt" },
    observed_state: { portal: "meet-joz" },
  });

  assert.equal(exported.trajectoryId, undefined);
  assert.equal(exported.sessionId, undefined);
  assert.equal(exported.stateBefore.userContext.email, undefined);
  assert.equal(exported.symbolicPrediction.input, undefined);
});
