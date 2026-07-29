import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyWorldTrajectory,
  normalizeWorldModelControls,
  shouldSampleWorldTrajectory,
} from "./worldModelControls.js";

test("world-model controls clamp production values", () => {
  const controls = normalizeWorldModelControls({
    JOZ_WORLD_MODEL_SAMPLE_RATE: "2",
    JOZ_WORLD_MODEL_MAX_CANDIDATES: "0",
    JOZ_WORLD_MODEL_EXCLUDE_DEV: "true",
  });

  assert.equal(controls.sampleRate, 1);
  assert.equal(controls.maxCandidates, 1);
  assert.equal(controls.excludeDevelopment, true);
});

test("local shadow mode samples every trajectory unless overridden", () => {
  assert.equal(normalizeWorldModelControls({}).sampleRate, 1);
  assert.equal(normalizeWorldModelControls({}, { production: true }).sampleRate, 0.25);
});

test("trajectory sampling is deterministic per trace", () => {
  assert.equal(shouldSampleWorldTrajectory("trace-1", 1), true);
  assert.equal(shouldSampleWorldTrajectory("trace-1", 0), false);
  assert.equal(
    shouldSampleWorldTrajectory("trace-1", 0.5),
    shouldSampleWorldTrajectory("trace-1", 0.5),
  );
});

test("unsupported observations are not classified as wrong predictions", () => {
  assert.deepEqual(
    classifyWorldTrajectory({ unsupportedOnly: true, hasPrediction: true, hasObservation: true }),
    { classification: "unsupported", failureCategory: "unsupported_fields" },
  );
});
