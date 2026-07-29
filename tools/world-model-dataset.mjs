import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { reconcileWorldTrajectory } from "../shared/worldTrajectory.js";
import { isWorldTrajectoryEvaluationEligible } from "../shared/worldModelControls.js";

const SENSITIVE_KEYS = /^(input|prompt|messages|token|authorization|cookie|email|phone|audio|image|frame|biometric|rawheaders?)$/i;

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function scrub(value, key = "") {
  if (SENSITIVE_KEYS.test(key)) return undefined;
  if (Array.isArray(value)) return value.map((item) => scrub(item)).filter((item) => item !== undefined);
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)) return "[redacted]";
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .map(([entryKey, entryValue]) => [entryKey, scrub(entryValue, entryKey)])
      .filter(([, entryValue]) => entryValue !== undefined)
  );
}

function parseJsonOrJsonl(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.records)) return parsed.records;
    return [parsed];
  } catch {
    return trimmed.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  }
}

function value(row, camel, snake = camel) {
  return row?.[camel] ?? row?.[snake];
}

export function normalizePersistedTrajectory(row = {}) {
  return {
    trajectoryId: value(row, "trajectoryId", "trajectory_id"),
    sessionId: value(row, "sessionId", "session_id"),
    schemaVersion: String(value(row, "schemaVersion", "schema_version") || "1.0"),
    stateBefore: value(row, "stateBefore", "state_before") || {},
    stateHistory: value(row, "stateHistory", "state_history") || [],
    proposedAction: value(row, "proposedAction", "proposed_action") || null,
    symbolicPrediction: value(row, "symbolicPrediction", "symbolic_prediction") || null,
    probabilisticPrediction: value(row, "probabilisticPrediction", "probabilistic_prediction") || null,
    expectedEffects: value(row, "expectedEffects", "expected_effects") || [],
    observationBefore: value(row, "observationBefore", "observation_before") || null,
    predictedObservation: value(row, "predictedObservation", "predicted_observation") || null,
    observedObservation: value(row, "observedObservation", "observed_observation") || null,
    observationDifference: value(row, "observationDifference", "observation_difference") || null,
    observedState: value(row, "observedState", "observed_state") || null,
    observedEffects: value(row, "observedEffects", "observed_effects") || [],
    predictionDifferences: value(row, "predictionDifferences", "prediction_differences") || null,
    plannerSelectedAction: value(row, "plannerSelectedAction", "planner_selected_action") || null,
    deterministicApprovedAction: value(row, "deterministicApprovedAction", "deterministic_approved_action") || null,
    candidatePlans: value(row, "candidatePlans", "candidate_plans") || [],
    fieldSupport: value(row, "fieldSupport", "field_support") || {},
    classification: value(row, "classification") || "partial",
    failureCategory: value(row, "failureCategory", "failure_category") || null,
    persistenceStatus: value(row, "persistenceStatus", "persistence_status") || null,
    consentCompatible: value(row, "consentCompatible", "consent_compatible") !== false,
    isTest: value(row, "isTest", "is_test") === true,
    isSynthetic: value(row, "isSynthetic", "is_synthetic") === true,
    success: value(row, "success"),
    outcomeScores: value(row, "outcomeScores", "outcome_scores") || {},
    modelVersion: value(row, "modelVersion", "model_version") || null,
    transitionRuleVersion: value(row, "transitionRuleVersion", "transition_rule_version") || null,
    worldModelMode: value(row, "worldModelMode", "world_model_mode") || "shadow",
    createdAt: value(row, "createdAt", "created_at") || null,
    observedAt: value(row, "observedAt", "observed_at") || null,
    predictionLatencyMs: value(row, "predictionLatencyMs", "prediction_latency_ms"),
    observationLatencyMs: value(row, "observationLatencyMs", "observation_latency_ms"),
    shadowLatencyMs: value(row, "shadowLatencyMs", "shadow_latency_ms"),
    sampleRate: value(row, "sampleRate", "sample_rate"),
  };
}

function actionType(action) {
  return typeof action === "string" ? action : action?.type || action?.action || null;
}

function predictedState(record) {
  return record.symbolicPrediction?.predictedState || record.symbolicPrediction?.predicted_state || null;
}

function predictedObservation(record) {
  return record.predictedObservation || record.symbolicPrediction?.predictedObservation || null;
}

function observedObservation(record) {
  return record.observedObservation || null;
}

function dateOf(record) {
  const date = new Date(record.observedAt || record.createdAt || 0);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function buildPrivacySafeDatasetRecord(row) {
  const record = normalizePersistedTrajectory(row);
  return scrub({
    schemaVersion: record.schemaVersion,
    worldModelMode: record.worldModelMode,
    modelVersion: record.modelVersion,
    transitionRuleVersion: record.transitionRuleVersion,
    stateBefore: record.stateBefore,
    stateHistory: record.stateHistory,
    proposedAction: record.proposedAction,
    plannerSelectedAction: record.plannerSelectedAction,
    deterministicApprovedAction: record.deterministicApprovedAction,
    candidatePlans: record.candidatePlans,
    symbolicPrediction: record.symbolicPrediction,
    probabilisticPrediction: record.probabilisticPrediction,
    expectedEffects: record.expectedEffects,
    observationBefore: record.observationBefore,
    predictedObservation: record.predictedObservation,
    observedObservation: record.observedObservation,
    observedState: record.observedState,
    observedEffects: record.observedEffects,
    observationDifference: record.observationDifference,
    predictionDifferences: record.predictionDifferences,
    fieldSupport: record.fieldSupport,
    classification: record.classification,
    failureCategory: record.failureCategory,
    success: record.success,
    outcomeScores: record.outcomeScores,
    predictionLatencyMs: record.predictionLatencyMs,
    observationLatencyMs: record.observationLatencyMs,
    shadowLatencyMs: record.shadowLatencyMs,
    sampleRate: record.sampleRate,
    createdAt: record.createdAt,
    observedAt: record.observedAt,
  });
}

function stableBucket(value) {
  return createHash("sha256").update(String(value || "missing")).digest("hex");
}

function metric(value, sampleCount, coverage, minimumSampleCount) {
  return {
    value: sampleCount >= minimumSampleCount ? value : null,
    fixtureValue: value,
    sampleCount,
    coverage,
    meaningful: sampleCount >= minimumSampleCount,
  };
}

export function evaluatePersistedTrajectories(rows = [], { minimumSampleCount = 10 } = {}) {
  const records = rows.map(normalizePersistedTrajectory);
  const eligible = records.filter(isWorldTrajectoryEvaluationEligible);
  const valid = eligible.filter((record) => record.classification === "valid" || (
    record.classification === "partial" && predictedState(record) && record.observedState
  ));
  const excluded = records.length - eligible.length;
  let exactState = 0;
  let portalMatches = 0;
  let stageMatches = 0;
  let plannerAgreements = 0;
  let plannerCompared = 0;
  let transformError = 0;
  let transformCompared = 0;
  let observationCompared = 0;
  let observationUnknown = 0;
  let guardrailViolations = 0;
  let payloadBytes = 0;
  const classCounts = {};
  const failureCounts = {};

  for (const record of records) {
    classCounts[record.classification] = (classCounts[record.classification] || 0) + 1;
    if (record.failureCategory) failureCounts[record.failureCategory] = (failureCounts[record.failureCategory] || 0) + 1;
    payloadBytes += Buffer.byteLength(JSON.stringify(record));
  }

  for (const record of valid) {
    const predicted = predictedState(record) || {};
    const observed = record.observedState || {};
    const reconciliation = record.predictionDifferences || reconcileWorldTrajectory({
      predictedState: predicted,
      observedState: observed,
      expectedEffects: record.expectedEffects,
      observedEffects: record.observedEffects,
    });
    if (reconciliation.success !== false) exactState += 1;
    if (String(predicted.portal || "") === String(observed.portal || "")) portalMatches += 1;
    if (String(predicted.stage || "") === String(observed.stage || "")) stageMatches += 1;
    const selected = actionType(record.plannerSelectedAction);
    const approved = actionType(record.deterministicApprovedAction);
    if (selected && approved) {
      plannerCompared += 1;
      if (selected === approved) plannerAgreements += 1;
    }
    const predictedTransforms = predictedObservation(record)?.sceneState?.objectTransforms || [];
    const observedTransforms = observedObservation(record)?.sceneState?.objectTransforms || [];
    const observedById = new Map(observedTransforms.map((item) => [item.id, item]));
    for (const item of predictedTransforms) {
      const actual = observedById.get(item.id);
      if (!actual) continue;
      for (const field of ["position", "rotation", "scale"]) {
        if (Array.isArray(item[field]) && Array.isArray(actual[field])) {
          transformCompared += 1;
          transformError += Math.sqrt(item[field].reduce((sum, value, index) => sum + ((Number(value) || 0) - (Number(actual[field][index]) || 0)) ** 2, 0));
        }
      }
    }
    const observationMetrics = record.observationDifference?.metrics;
    if (observationMetrics) {
      observationCompared += Number(observationMetrics.comparedFieldCount || 0);
      observationUnknown += Number(observationMetrics.unknownFieldCount || 0);
    }
    guardrailViolations += record.classification === "invalid_action" ? 1 : 0;
  }

  const dates = eligible.map(dateOf).filter(Boolean).sort();
  const sessions = new Set(records.map((record) => record.sessionId).filter(Boolean));
  const sampleCount = valid.length;
  const coverage = records.length ? sampleCount / records.length : 0;
  return {
    schemaVersion: "1.0",
    evaluationType: "persisted_world_model_trajectories",
    minimumMeaningfulSampleCount: minimumSampleCount,
    totalRecords: records.length,
    validRecords: valid.length,
    excludedRecords: excluded,
    sessionCount: sessions.size,
    dateRange: { from: dates[0] || null, to: dates.at(-1) || null },
    coverage: metric(coverage, records.length, records.length ? 1 : 0, minimumSampleCount),
    classificationCounts: classCounts,
    failureCounts: failureCounts,
    metrics: {
      nextStateAccuracy: metric(sampleCount ? exactState / sampleCount : 0, sampleCount, coverage, minimumSampleCount),
      portalAccuracy: metric(sampleCount ? portalMatches / sampleCount : 0, sampleCount, coverage, minimumSampleCount),
      stageAccuracy: metric(sampleCount ? stageMatches / sampleCount : 0, sampleCount, coverage, minimumSampleCount),
      plannerAgreement: metric(plannerCompared ? plannerAgreements / plannerCompared : 0, plannerCompared, plannerCompared / Math.max(1, sampleCount), minimumSampleCount),
      meanTransformError: metric(transformCompared ? transformError / transformCompared : 0, transformCompared, transformCompared / Math.max(1, sampleCount), minimumSampleCount),
      predictionCoverage: metric(observationCompared ? 1 - observationUnknown / observationCompared : 0, observationCompared, observationCompared / Math.max(1, sampleCount), minimumSampleCount),
      unknownUnsupportedFieldRate: metric(observationCompared ? observationUnknown / observationCompared : 0, observationCompared, observationCompared / Math.max(1, sampleCount), minimumSampleCount),
      predictionLatencyMs: metric(sampleCount ? valid.reduce((sum, record) => sum + (Number(record.predictionLatencyMs || record.shadowLatencyMs) || 0), 0) / sampleCount : 0, sampleCount, coverage, minimumSampleCount),
      observationLatencyMs: metric(sampleCount ? valid.reduce((sum, record) => sum + (Number(record.observationLatencyMs) || 0), 0) / sampleCount : 0, sampleCount, coverage, minimumSampleCount),
      meanPayloadBytes: metric(records.length ? payloadBytes / records.length : 0, records.length, 1, minimumSampleCount),
      guardrailViolations: metric(guardrailViolations, sampleCount, coverage, minimumSampleCount),
    },
    limitations: [
      "Unsupported fields are reported as unknown and are not counted as prediction errors.",
      "Metrics become production-meaningful only after the documented minimum sample count is reached.",
      "Evaluation does not imply that the predictive shadow can select or execute live actions.",
    ],
  };
}

export async function loadTrajectoryFile(filePath) {
  return parseJsonOrJsonl(await readFile(filePath, "utf8"));
}

export async function exportPrivacySafeDataset(rows, outputDir, { from = null, to = null } = {}) {
  const normalized = rows.map(normalizePersistedTrajectory)
    .filter((record) => isWorldTrajectoryEvaluationEligible(record))
    .filter((record) => !from || dateOf(record) >= new Date(from).toISOString())
    .filter((record) => !to || dateOf(record) < new Date(to).toISOString())
    .sort((left, right) => `${dateOf(left)}:${left.trajectoryId}`.localeCompare(`${dateOf(right)}:${right.trajectoryId}`));
  const exclusions = rows.length - normalized.length;
  const groups = new Map();
  for (const record of normalized) {
    const groupKey = record.sessionId || record.trajectoryId || `${dateOf(record)}:${actionType(record.proposedAction)}`;
    const bucket = stableBucket(groupKey);
    const split = parseInt(bucket.slice(0, 8), 16) % 100 < 80
      ? "train"
      : parseInt(bucket.slice(0, 8), 16) % 100 < 90 ? "validation" : "test";
    if (!groups.has(split)) groups.set(split, []);
    groups.get(split).push(buildPrivacySafeDatasetRecord(record));
  }
  await mkdir(outputDir, { recursive: true });
  const files = {};
  for (const split of ["train", "validation", "test"]) {
    const content = (groups.get(split) || []).map((record) => JSON.stringify(record)).join("\n") + ((groups.get(split) || []).length ? "\n" : "");
    const filePath = path.join(outputDir, `${split}.jsonl`);
    await writeFile(filePath, content, "utf8");
    files[split] = { path: filePath, records: groups.get(split)?.length || 0, sha256: createHash("sha256").update(content).digest("hex") };
  }
  const manifest = {
    manifestVersion: "1.0",
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    recordCount: normalized.length,
    excludedCount: exclusions,
    exclusions: { testOrSyntheticOrConsent: exclusions, rawSensitiveFields: "redacted_or_excluded" },
    dateRange: { from: normalized.map(dateOf).filter(Boolean)[0] || null, to: normalized.map(dateOf).filter(Boolean).at(-1) || null },
    splitStrategy: "session_or_journey_hash; no session is shared across splits",
    files,
  };
  await writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}
