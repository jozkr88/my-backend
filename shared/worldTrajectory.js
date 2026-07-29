import { buildWorldObservation } from "./worldObservation.js";

export const WORLD_TRAJECTORY_SCHEMA_VERSION = "1.0";
export const WORLD_MODEL_VERSION = "symbolic-experience-v1";
export const WORLD_TRANSITION_RULE_VERSION = "meetjoz-world-v1";

const CORE_STATE_FIELDS = [
  "portal",
  "sequence",
  "stage",
  "currentStateKey",
  "focusedEntityId",
  "visibleEntityIds",
  "visitedPortalIds",
];

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, maxLength = 240) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanArray(value, maxLength = 40) {
  return Array.isArray(value)
    ? value.filter(Boolean).slice(0, maxLength).map((item) => cleanText(item, 160))
    : [];
}

function comparable(value) {
  return JSON.stringify(value ?? null);
}

function comparableStateValue(field, value) {
  if (field === "portal") {
    return String(value || "").trim().toLowerCase().replace("meet_joz", "meet-joz");
  }
  if (["visibleEntityIds", "visitedPortalIds"].includes(field) && Array.isArray(value)) {
    return [...value]
      .map((item) => String(item).trim().toLowerCase().replace("meet_joz", "meet-joz"))
      .sort();
  }
  return value ?? null;
}

function sanitizeState(state = {}) {
  const safe = clone(state) || {};
  safe.userContext = {
    intent: cleanText(safe.userContext?.intent, 120) || null,
    goal: cleanText(safe.userContext?.goal, 240) || null,
    interests: cleanArray(safe.userContext?.interests, 12),
  };
  delete safe.timestamp;
  return safe;
}

function sanitizeObservation(observation = null) {
  if (!observation || typeof observation !== "object") return null;
  return buildWorldObservation({
    ...observation,
    observationId: observation.observationId || `observation-${Date.now()}`,
    sourceVersions: observation.sourceVersions || {},
  });
}

export function reconcileWorldTrajectory({
  predictedState = {},
  observedState = {},
  expectedEffects = [],
  observedEffects = [],
} = {}) {
  const differences = [];

  for (const field of CORE_STATE_FIELDS) {
    if (
      comparable(comparableStateValue(field, predictedState[field])) ===
      comparable(comparableStateValue(field, observedState[field]))
    ) continue;
    const critical = ["portal", "stage", "currentStateKey"].includes(field);
    differences.push({
      field,
      severity: critical ? "error" : "acceptable_difference",
      predicted: clone(predictedState[field] ?? null),
      observed: clone(observedState[field] ?? null),
    });
  }

  const expectedEffectTypes = new Set(
    expectedEffects.map((effect) => cleanText(effect?.type || effect, 80)).filter(Boolean)
  );
  const observedEffectTypes = new Set(
    observedEffects.map((effect) => cleanText(effect?.type || effect, 80)).filter(Boolean)
  );
  const unexpectedEffects = [...observedEffectTypes].filter((effect) => !expectedEffectTypes.has(effect));
  for (const effect of unexpectedEffects) {
    differences.push({
      field: "effects",
      severity: "unexpected_effect",
      predicted: null,
      observed: effect,
    });
  }

  const criticalMismatchCount = differences.filter((item) => item.severity === "error").length;
  const acceptableDifferenceCount = differences.filter(
    (item) => item.severity === "acceptable_difference"
  ).length;

  return {
    exactMatch: differences.length === 0,
    success: criticalMismatchCount === 0,
    differences,
    metrics: {
      comparedFieldCount: CORE_STATE_FIELDS.length,
      mismatchCount: differences.length,
      criticalMismatchCount,
      acceptableDifferenceCount,
      exactMatchRate: differences.length === 0 ? 1 : 0,
      unexpectedEffectCount: unexpectedEffects.length,
    },
  };
}

export function buildWorldTrajectoryRecord({
  trajectoryId,
  sessionId = null,
  traceId = trajectoryId,
  stateBefore = {},
  stateHistory = [],
  proposedAction = null,
  symbolicPrediction = null,
  probabilisticPrediction = null,
  expectedEffects = [],
  observationBefore = null,
  predictedObservation = null,
  observedObservation = null,
  observationDifference = null,
  observationSourceVersions = {},
  observedState = null,
  observedEffects = [],
  intent = "spatial_navigation",
  goal = "world_navigation",
  interactionChannel = "voice",
  transitionDurationMs = null,
  success = null,
  predictionDifferences = null,
  confidenceBeforeAction = null,
  outcomeScores = {},
  modelVersion = WORLD_MODEL_VERSION,
  transitionRuleVersion = WORLD_TRANSITION_RULE_VERSION,
  createdAt = new Date().toISOString(),
  observedAt = null,
  shadowLatencyMs = null,
  worldModelMode = "shadow",
  plannerSelectedAction = null,
  deterministicApprovedAction = null,
  candidatePlans = [],
  expectedObservedEffects = null,
  fieldSupport = {},
  classification = null,
  failureCategory = null,
  persistenceStatus = "pending",
  predictionLatencyMs = null,
  observationLatencyMs = null,
  sampleRate = null,
  sampled = true,
  consentCompatible = true,
  isTest = false,
  isSynthetic = false,
  exclusionReason = null,
} = {}) {
  const safeStateBefore = sanitizeState(stateBefore);
  const safeObservationBefore = sanitizeObservation(observationBefore);
  const safePredictedObservation = sanitizeObservation(predictedObservation);
  const safeObservedObservation = sanitizeObservation(observedObservation);
  const safeObservedState = observedState ? sanitizeState(observedState) : null;
  const reconciliation =
    predictionDifferences ||
    (safeObservedState && symbolicPrediction?.predictedState
      ? reconcileWorldTrajectory({
          predictedState: symbolicPrediction.predictedState,
          observedState: safeObservedState,
          expectedEffects,
          observedEffects,
        })
      : null);

  return {
    schemaVersion: WORLD_TRAJECTORY_SCHEMA_VERSION,
    trajectoryId: cleanText(trajectoryId, 120),
    sessionId: cleanText(sessionId, 120) || null,
    traceId: cleanText(traceId, 120) || null,
    stateBefore: safeStateBefore,
    stateHistory: Array.isArray(stateHistory) ? stateHistory.slice(-20).map(sanitizeState) : [],
    proposedAction: clone(proposedAction),
    symbolicPrediction: clone(symbolicPrediction),
    probabilisticPrediction: clone(probabilisticPrediction),
    expectedEffects: clone(expectedEffects) || [],
    observationBefore: safeObservationBefore,
    predictedObservation: safePredictedObservation,
    observedObservation: safeObservedObservation,
    observationDifference: clone(observationDifference) || null,
    observationSourceVersions: clone(observationSourceVersions) || {},
    observedState: safeObservedState,
    observedEffects: clone(observedEffects) || [],
    intent: cleanText(intent, 120),
    goal: cleanText(goal, 240),
    interactionChannel: cleanText(interactionChannel, 40) || "unknown",
    transitionDurationMs: Number.isFinite(Number(transitionDurationMs))
      ? Math.max(0, Math.round(Number(transitionDurationMs)))
      : null,
    success: typeof success === "boolean" ? success : reconciliation?.success ?? null,
    predictionDifferences: reconciliation,
    confidenceBeforeAction:
      Number.isFinite(Number(confidenceBeforeAction))
        ? Math.max(0, Math.min(1, Number(confidenceBeforeAction)))
        : null,
    outcomeScores: clone(outcomeScores) || {},
    modelVersion: cleanText(modelVersion, 120),
    transitionRuleVersion: cleanText(transitionRuleVersion, 120),
    shadowLatencyMs: Number.isFinite(Number(shadowLatencyMs))
      ? Math.max(0, Math.round(Number(shadowLatencyMs)))
      : null,
    worldModelMode: cleanText(worldModelMode, 24) || "shadow",
    plannerSelectedAction: clone(plannerSelectedAction),
    deterministicApprovedAction: clone(deterministicApprovedAction),
    candidatePlans: Array.isArray(candidatePlans) ? clone(candidatePlans.slice(0, 8)) : [],
    expectedObservedEffects: clone(expectedObservedEffects) || null,
    fieldSupport: clone(fieldSupport) || {},
    classification: cleanText(classification, 32) || null,
    failureCategory: cleanText(failureCategory, 64) || null,
    persistenceStatus: cleanText(persistenceStatus, 32) || "pending",
    predictionLatencyMs: Number.isFinite(Number(predictionLatencyMs))
      ? Math.max(0, Math.round(Number(predictionLatencyMs)))
      : null,
    observationLatencyMs: Number.isFinite(Number(observationLatencyMs))
      ? Math.max(0, Math.round(Number(observationLatencyMs)))
      : null,
    sampleRate: Number.isFinite(Number(sampleRate))
      ? Math.max(0, Math.min(1, Number(sampleRate)))
      : null,
    sampled: sampled !== false,
    consentCompatible: consentCompatible !== false,
    isTest: isTest === true,
    isSynthetic: isSynthetic === true,
    exclusionReason: cleanText(exclusionReason, 120) || null,
    createdAt,
    observedAt,
  };
}

export function normalizeWorldTrajectoryRecord(record = {}) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { valid: false, errors: ["RECORD_NOT_OBJECT"], record: null };
  }

  const errors = [];
  if (!cleanText(record.trajectoryId, 120)) errors.push("TRAJECTORY_ID_MISSING");
  if (!record.stateBefore || typeof record.stateBefore !== "object") errors.push("STATE_BEFORE_MISSING");
  if (record.schemaVersion && String(record.schemaVersion) !== WORLD_TRAJECTORY_SCHEMA_VERSION) {
    errors.push("SCHEMA_VERSION_UNSUPPORTED");
  }

  const normalized = buildWorldTrajectoryRecord({
    ...record,
    trajectoryId: record.trajectoryId,
    schemaVersion: WORLD_TRAJECTORY_SCHEMA_VERSION,
  });

  return {
    valid: errors.length === 0,
    errors,
    record: errors.length === 0 ? normalized : null,
  };
}
