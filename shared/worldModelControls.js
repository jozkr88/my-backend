export const WORLD_MODEL_DEFAULTS = Object.freeze({
  sampleRate: 0.25,
  maxTrajectoryBytes: 250_000,
  maxHistory: 20,
  maxCandidates: 8,
  maxRolloutDepth: 4,
  persistenceTimeoutMs: 250,
  retentionDays: 30,
});

export function boundedNumber(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

export function normalizeWorldModelControls(env = {}, { production = false } = {}) {
  const excludeDevelopment = String(
    env.JOZ_WORLD_MODEL_EXCLUDE_DEV ?? (production ? "true" : "false")
  ).trim().toLowerCase() === "true";
  const defaultSampleRate = production ? WORLD_MODEL_DEFAULTS.sampleRate : 1;

  return {
    sampleRate: boundedNumber(
      env.JOZ_WORLD_MODEL_SAMPLE_RATE,
      defaultSampleRate,
      { min: 0, max: 1 }
    ),
    maxTrajectoryBytes: Math.round(boundedNumber(
      env.JOZ_WORLD_MODEL_MAX_TRAJECTORY_BYTES,
      WORLD_MODEL_DEFAULTS.maxTrajectoryBytes,
      { min: 16_384, max: 1_000_000 }
    )),
    maxHistory: Math.round(boundedNumber(
      env.JOZ_WORLD_MODEL_MAX_HISTORY,
      WORLD_MODEL_DEFAULTS.maxHistory,
      { min: 1, max: 100 }
    )),
    maxCandidates: Math.round(boundedNumber(
      env.JOZ_WORLD_MODEL_MAX_CANDIDATES,
      WORLD_MODEL_DEFAULTS.maxCandidates,
      { min: 1, max: 32 }
    )),
    maxRolloutDepth: Math.round(boundedNumber(
      env.JOZ_WORLD_MODEL_MAX_ROLLOUT_DEPTH,
      WORLD_MODEL_DEFAULTS.maxRolloutDepth,
      { min: 1, max: 12 }
    )),
    persistenceTimeoutMs: Math.round(boundedNumber(
      env.JOZ_WORLD_MODEL_PERSISTENCE_TIMEOUT_MS,
      WORLD_MODEL_DEFAULTS.persistenceTimeoutMs,
      { min: 25, max: 2_000 }
    )),
    retentionDays: Math.round(boundedNumber(
      env.JOZ_WORLD_MODEL_RETENTION_DAYS,
      WORLD_MODEL_DEFAULTS.retentionDays,
      { min: 1, max: 365 }
    )),
    excludeDevelopment,
  };
}

function stableHash(value = "") {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export function shouldSampleWorldTrajectory(traceId, sampleRate) {
  const rate = boundedNumber(sampleRate, WORLD_MODEL_DEFAULTS.sampleRate, { min: 0, max: 1 });
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  return stableHash(traceId || "missing-trace") < rate;
}

export function isLikelyWorldModelBot(userAgent = "") {
  return /bot|crawler|spider|headless|uptime|monitor|preview/i.test(String(userAgent || ""));
}

export function classifyWorldTrajectory({
  hasPrediction = false,
  hasObservation = false,
  observationCaptureFailed = false,
  predictionFailed = false,
  persistenceFailed = false,
  invalidAction = false,
  unsupportedOnly = false,
  interrupted = false,
  isTest = false,
  isSynthetic = false,
} = {}) {
  if (isTest) return { classification: "test", failureCategory: "test_fixture" };
  if (isSynthetic) return { classification: "synthetic", failureCategory: "controlled_scenario" };
  if (persistenceFailed) return { classification: "persistence_failure", failureCategory: "persistence" };
  if (invalidAction) return { classification: "invalid_action", failureCategory: "guardrail_block" };
  if (observationCaptureFailed) return { classification: "observation_failure", failureCategory: "observation_capture" };
  if (predictionFailed) return { classification: "prediction_failure", failureCategory: "shadow_prediction" };
  if (interrupted) return { classification: "interrupted", failureCategory: "incomplete_transition" };
  if (unsupportedOnly) return { classification: "unsupported", failureCategory: "unsupported_fields" };
  if (hasPrediction && hasObservation) return { classification: "valid", failureCategory: null };
  return { classification: "partial", failureCategory: "missing_prediction_or_observation" };
}

export function isWorldTrajectoryEvaluationEligible(record = {}) {
  return record?.consentCompatible !== false &&
    record?.isTest !== true &&
    record?.isSynthetic !== true &&
    !["test", "synthetic"].includes(record?.classification);
}
