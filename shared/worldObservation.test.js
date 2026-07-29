import test from "node:test";
import assert from "node:assert/strict";

import {
  WORLD_OBSERVATION_MAX_OBJECTS,
  buildWorldObservation,
  observeWorld,
  predictObservation,
  reconcileWorldObservations,
} from "./worldObservation.js";

test("observations are deterministic, serialisable, and normalised", () => {
  const runtimeObject = { name: "runtime" };
  runtimeObject.self = runtimeObject;
  const observation = observeWorld({
    observationId: "obs-1",
    symbolicState: { portal: "meet_joz", availableActionIds: ["skills", "vibe", "vibe"] },
    sceneState: {
      visibleObjectIds: ["B", "a", "b"],
      objectTransforms: [
        { id: "B", position: [1, 2, 3], rotation: [0, 0, 0], scale: [1, 1, 1], runtimeObject },
      ],
    },
  });

  assert.deepEqual(observation.symbolicState.availableActionIds, ["skills", "vibe"]);
  assert.deepEqual(observation.sceneState.visibleObjectIds, ["a", "b"]);
  assert.equal(observation.sceneState.objectTransforms[0].id, "b");
  assert.doesNotThrow(() => JSON.stringify(observation));
  assert.equal(observation.sceneState.objectTransforms[0].runtimeObject, undefined);
});

test("missing renderer and camera data is represented as unknown", () => {
  const observation = observeWorld({
    symbolicState: { portal: "root" },
    missingFields: ["cameraState", "sceneState.objectTransforms"],
    fieldSupport: { cameraState: "unknown", objectTransforms: "unknown" },
  });

  assert.ok(observation.missingFields.includes("cameraState"));
  assert.equal(observation.fieldSupport.cameraState, "unknown");
  assert.equal(observation.cameraState.position, undefined);
});

test("predicted observations derive supported symbolic fields and mark unsupported scene fields", () => {
  const current = observeWorld({
    symbolicState: { portal: "root", stage: null },
    sceneState: { activePortal: "root", visibleObjectIds: ["ball"] },
    fieldSupport: { visibleObjectIds: "observed" },
  });
  const prediction = predictObservation(current, "ball", {
    portal: "meet-joz",
    stage: "vibe",
    currentStateKey: "meet_joz_flex_stage",
    environment: { activeOverlays: ["ar"] },
  });

  assert.equal(prediction.predictedObservation.sceneState.activePortal, "meet-joz");
  assert.deepEqual(prediction.predictedObservation.overlays.activeIds, ["ar"]);
  assert.ok(prediction.unsupportedFields.includes("sceneState.objectTransforms"));
});

test("visible objects and transforms reconcile with documented tolerance", () => {
  const base = buildWorldObservation({
    symbolicState: { portal: "meet-joz", stage: "vibe" },
    sceneState: {
      activePortal: "meet-joz",
      activeStage: "vibe",
      visibleObjectIds: ["ball", "capsule"],
      focusedEntityId: "capsule",
      objectTransforms: [
        { id: "capsule", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      ],
    },
    overlays: { activeIds: ["ar"] },
    fieldSupport: { objectTransforms: "observed" },
  });
  const observed = buildWorldObservation({
    ...base,
    observationId: "obs-2",
    sceneState: {
      ...base.sceneState,
      visibleObjectIds: ["capsule", "ball"],
      objectTransforms: [
        { id: "capsule", position: [0.01, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      ],
    },
  });
  const result = reconcileWorldObservations(base, observed);

  assert.equal(result.success, true);
  assert.equal(result.metrics.visibleObjectF1, 1);
  assert.equal(result.metrics.transformErrorCount, 0);
});

test("visible-object mismatches are measured without mutating observations", () => {
  const predicted = buildWorldObservation({
    symbolicState: { portal: "root" },
    sceneState: { visibleObjectIds: ["ball", "brain"] },
  });
  const observed = buildWorldObservation({
    symbolicState: { portal: "root" },
    sceneState: { visibleObjectIds: ["ball", "unknown-object"] },
  });
  const before = JSON.stringify(predicted);
  const result = reconcileWorldObservations(predicted, observed);

  assert.equal(result.success, false);
  assert.equal(result.metrics.unexpectedObjectRate, 0.5);
  assert.equal(JSON.stringify(predicted), before);
});

test("observation payloads are bounded", () => {
  const observation = buildWorldObservation({
    sceneState: {
      objectTransforms: Array.from({ length: WORLD_OBSERVATION_MAX_OBJECTS + 50 }, (_, index) => ({
        id: `object-${index}`,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      })),
    },
  });

  assert.equal(observation.sceneState.objectTransforms.length, WORLD_OBSERVATION_MAX_OBJECTS);
  assert.ok(observation.payloadBytes <= 80_000);
  assert.equal(observation.payloadWithinLimit, true);
});
