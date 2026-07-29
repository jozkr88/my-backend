import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWorldTrajectoryRecord,
  normalizeWorldTrajectoryRecord,
  reconcileWorldTrajectory,
} from "./worldTrajectory.js";

test("trajectory records are versioned and omit raw user input", () => {
  const record = buildWorldTrajectoryRecord({
    trajectoryId: "trajectory-1",
    traceId: "trace-1",
    stateBefore: { portal: "root", userContext: { intent: "explore", email: "secret@example.com" } },
    proposedAction: "ball",
    symbolicPrediction: { predictedState: { portal: "meet_joz" } },
    observedState: { portal: "meet_joz" },
    success: true,
  });

  assert.equal(record.schemaVersion, "1.0");
  assert.equal(record.trajectoryId, "trajectory-1");
  assert.equal(record.stateBefore.userContext.email, undefined);
  assert.equal(record.success, true);
});

test("trajectory records carry bounded predicted and observed observations", () => {
  const record = buildWorldTrajectoryRecord({
    trajectoryId: "trajectory-observation-1",
    stateBefore: { portal: "root" },
    observationBefore: {
      observationId: "before-1",
      symbolicState: { portal: "root" },
      sceneState: { visibleObjectIds: ["ball"] },
      missingFields: ["cameraState"],
    },
    predictedObservation: {
      observationId: "predicted-1",
      symbolicState: { portal: "meet-joz" },
      sceneState: { visibleObjectIds: ["capsule"] },
    },
    observedObservation: {
      observationId: "observed-1",
      symbolicState: { portal: "meet-joz" },
      sceneState: { visibleObjectIds: ["capsule"] },
    },
    observationDifference: { metrics: { visibleObjectF1: 1 } },
  });

  assert.equal(record.predictedObservation.schemaVersion, "1.0");
  assert.equal(record.observedObservation.sceneState.visibleObjectIds[0], "capsule");
  assert.deepEqual(record.observationDifference.metrics, { visibleObjectF1: 1 });
});

test("reconciliation distinguishes exact state matches from critical mismatches", () => {
  const exact = reconcileWorldTrajectory({
    predictedState: { portal: "meet_joz", stage: "vibe" },
    observedState: { portal: "meet_joz", stage: "vibe" },
  });
  const mismatch = reconcileWorldTrajectory({
    predictedState: { portal: "meet_joz", stage: "vibe" },
    observedState: { portal: "maxx", stage: "signal_flow" },
  });

  assert.equal(exact.success, true);
  assert.equal(exact.metrics.exactMatchRate, 1);
  assert.equal(mismatch.success, false);
  assert.equal(mismatch.metrics.criticalMismatchCount, 2);
});

test("reconciliation treats portal aliases and entity ordering as equivalent", () => {
  const result = reconcileWorldTrajectory({
    predictedState: {
      portal: "meet_joz",
      visibleEntityIds: ["b", "a"],
      visitedPortalIds: ["root", "meet_joz"],
    },
    observedState: {
      portal: "meet-joz",
      visibleEntityIds: ["a", "b"],
      visitedPortalIds: ["meet-joz", "root"],
    },
  });

  assert.equal(result.exactMatch, true);
  assert.equal(result.metrics.mismatchCount, 0);
});

test("malformed historical trajectory data is rejected", () => {
  const result = normalizeWorldTrajectoryRecord({
    schemaVersion: "0.1",
    observedState: {},
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("TRAJECTORY_ID_MISSING"));
  assert.ok(result.errors.includes("STATE_BEFORE_MISSING"));
  assert.ok(result.errors.includes("SCHEMA_VERSION_UNSUPPORTED"));
});
