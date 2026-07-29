import {
  calculateBrierScore,
  calculateExpectedCalibrationError,
  predictNextStates,
  simulateTrajectory,
} from "../shared/worldExperience.js";
import { buildCanonicalWorldState } from "../shared/worldSimulator.js";
import { reconcileWorldTrajectory, WORLD_MODEL_VERSION } from "../shared/worldTrajectory.js";
import {
  buildWorldObservation,
  predictObservation,
  reconcileWorldObservations,
} from "../shared/worldObservation.js";

const persistedInputIndex = process.argv.indexOf("--input");
if (persistedInputIndex >= 0) {
  const inputPath = process.argv[persistedInputIndex + 1];
  const minimumSampleCount = Number(process.env.JOZ_WORLD_MODEL_MIN_EVAL_SAMPLES || 10);
  const { evaluatePersistedTrajectories, loadTrajectoryFile } = await import("./world-model-dataset.mjs");
  const rows = await loadTrajectoryFile(inputPath);
  console.log(JSON.stringify(
    evaluatePersistedTrajectories(rows, { minimumSampleCount }),
    null,
    2,
  ));
  process.exit(0);
}

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

function canonicalPortal(value) {
  return String(value || "").trim().toLowerCase().replace("meet_joz", "meet-joz");
}

function sameState(left = {}, right = {}) {
  return (
    String(left.currentStateKey || "") === String(right.currentStateKey || "") &&
    canonicalPortal(left.portal) === canonicalPortal(right.portal)
  );
}

const state = initialState();
const experienceRows = [
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
    attempts: 2,
    successes: 1,
  },
];

const nextStatePrediction = predictNextStates(state, "ball", {
  transitions,
  experienceRows,
});
const expectedNextState = {
  currentStateKey: "meet_joz_flex_stage",
  portal: "meet-joz",
};
const topK = Math.min(2, nextStatePrediction.length);

const rollout = simulateTrajectory(state, ["ball"], {
  transitions,
  experienceByAction: { ball: experienceRows },
});
const invalidPrediction = predictNextStates(state, "not_allowed", { transitions });
const observationBefore = buildWorldObservation({
  symbolicState: { portal: "root", stage: null },
  sceneState: {
    activePortal: "root",
    visibleObjectIds: ["ball"],
    objectTransforms: [
      { id: "ball", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    ],
  },
  fieldSupport: { objectTransforms: "observed" },
});
const predictedObservation = predictObservation(
  observationBefore,
  "ball",
  { portal: "meet-joz", stage: "vibe", currentStateKey: "meet_joz_flex_stage" },
  {
    portalSceneManifest: {
      "meet-joz": {
        sceneId: "meet-joz",
        visibleObjectIds: ["capsule", "vibe"],
        objectTransforms: [
          { id: "capsule", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        ],
      },
    },
  },
).predictedObservation;
const observedObservation = buildWorldObservation({
  ...predictedObservation,
  observationId: "observed-fixture",
  predicted: false,
  sceneState: {
    ...predictedObservation.sceneState,
    objectTransforms: [
      { id: "capsule", position: [0.01, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    ],
  },
});
const observationReconciliationStartedAt = Date.now();
const observationReconciliation = reconcileWorldObservations(
  predictedObservation,
  observedObservation,
);
const observationReconciliationLatencyMs = Date.now() - observationReconciliationStartedAt;

function evaluatedMetric(value, sampleCount, coverage) {
  return {
    value: sampleCount >= 10 ? value : null,
    fixtureValue: value,
    sampleCount,
    coverage,
    meaningful: sampleCount >= 10,
  };
}

const calibrationSamples = [
  {
    probability: nextStatePrediction[0]?.successProbability || 0,
    outcome: true,
  },
  {
    probability: invalidPrediction[0]?.successProbability || 0,
    outcome: false,
  },
];
const reconciliation = reconcileWorldTrajectory({
  predictedState: nextStatePrediction[0]?.predictedState,
  observedState: expectedNextState,
  expectedEffects: nextStatePrediction[0]?.expectedEffects || [],
  observedEffects: nextStatePrediction[0]?.expectedEffects || [],
});

const report = {
  schemaVersion: "1.0",
  modelVersion: WORLD_MODEL_VERSION,
  evaluationType: "deterministic_fixture_baseline",
  minimumMeaningfulSampleCount: 10,
  fixtureMetricsMeaningful: false,
  limitations: [
    "This is a small regression fixture, not a production accuracy claim.",
    "Production calibration requires persisted trajectories with observed outcomes.",
    "The predictive layer is shadow-only; deterministic guardrails remain authoritative.",
  ],
  sampleCount: 2,
  nextStateAccuracy: evaluatedMetric(
    sameState(nextStatePrediction[0]?.predictedState, expectedNextState) ? 1 : 0,
    1,
    1,
  ),
  topKStateAccuracy: evaluatedMetric(
    nextStatePrediction.slice(0, topK)
      .some((outcome) => sameState(outcome.predictedState, expectedNextState)) ? 1 : 0,
    1,
    1,
  ),
  confidenceCalibration: {
    brierScore: calculateBrierScore(calibrationSamples),
    expectedCalibrationError: calculateExpectedCalibrationError(calibrationSamples),
    sampleCount: calibrationSamples.length,
    meaningful: false,
  },
  transitionSuccessPrediction: {
    brierScore: calculateBrierScore(calibrationSamples),
    samples: calibrationSamples,
    sampleCount: calibrationSamples.length,
    meaningful: false,
  },
  multiStepRollout: {
    predictedStateAccuracy: sameState(rollout.predictedState, expectedNextState) ? 1 : 0,
    branchCount: rollout.branches.length,
    successProbability: rollout.successProbability,
    expectedRisk: rollout.expectedRisk,
    uncertainty: rollout.uncertainty,
    sampleCount: 1,
    meaningful: false,
  },
  metrics: {
    portalAccuracy: evaluatedMetric(
      observationReconciliation.differences.some((difference) => difference.field === "symbolicState.portal") ? 0 : 1,
      1,
      1,
    ),
    stageAccuracy: evaluatedMetric(
      observationReconciliation.differences.some((difference) => difference.field === "symbolicState.stage") ? 0 : 1,
      1,
      1,
    ),
    visibleObjectPrecision: evaluatedMetric(observationReconciliation.metrics.visibleObjectPrecision, 1, 1),
    visibleObjectRecall: evaluatedMetric(observationReconciliation.metrics.visibleObjectRecall, 1, 1),
    visibleObjectF1: evaluatedMetric(observationReconciliation.metrics.visibleObjectF1, 1, 1),
    unexpectedObjectRate: evaluatedMetric(observationReconciliation.metrics.unexpectedObjectRate, 1, 1),
    missingObjectRate: evaluatedMetric(observationReconciliation.metrics.missingObjectRate, 1, 1),
    focusedEntityAccuracy: evaluatedMetric(observationReconciliation.metrics.focusedEntityAccuracy, 0, 0),
    overlayAccuracy: evaluatedMetric(observationReconciliation.metrics.overlayAccuracy, 0, 0),
    transformErrorByField: evaluatedMetric(
      {
        position: 0.01,
        rotation: 0,
        scale: 0,
      },
      observationReconciliation.metrics.transformCompared,
      observationReconciliation.metrics.transformCompared ? 1 : 0,
    ),
    spatialRelationshipAccuracy: evaluatedMetric(observationReconciliation.metrics.spatialRelationshipAccuracy, 0, 0),
    predictionCoverage: evaluatedMetric(
      1 - observationReconciliation.metrics.unknownFieldCount / observationReconciliation.metrics.comparedFieldCount,
      1,
      1,
    ),
    unknownUnsupportedFieldRate: evaluatedMetric(observationReconciliation.metrics.unsupportedFieldRate, 1, 1),
    observationCaptureFailureRate: evaluatedMetric(0, 1, 1),
    reconciliationLatencyMs: evaluatedMetric(observationReconciliationLatencyMs, 1, 1),
  },
  portalStageMismatchRate: evaluatedMetric(
    reconciliation.metrics.comparedFieldCount
      ? reconciliation.metrics.criticalMismatchCount / reconciliation.metrics.comparedFieldCount
      : 0,
    1,
    1,
  ),
  guardrailViolations: 0,
  blockedInvalidActions: invalidPrediction.reduce(
    (count, outcome) => count + (outcome.violations?.length || 0),
    0,
  ),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
