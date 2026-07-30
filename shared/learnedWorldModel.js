import { createHash } from "node:crypto";

export const LEARNED_WORLD_MODEL_SCHEMA_VERSION = "1.0";
export const LEARNED_WORLD_MODEL_VERSION = "learned-structured-transition-v1";

const STATE_FIELDS = [
  "portal",
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

function token(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function canonical(value) {
  if (Array.isArray(value)) {
    return value.map((item) => token(item).replace("meet_joz", "meet-joz")).sort();
  }
  if (typeof value === "string") return token(value).replace("meet_joz", "meet-joz");
  return value ?? null;
}

function stateProjection(state = {}) {
  return Object.fromEntries(STATE_FIELDS.map((field) => [field, canonical(state[field])]));
}

function stableJson(value) {
  return JSON.stringify(value);
}

function stateKey(state = {}) {
  return stableJson(stateProjection(state));
}

function actionKey(action) {
  if (typeof action === "string") return token(action);
  return token(action?.type || action?.action || action?.id);
}

function transitionKey(state, action) {
  return `${stateKey(state)}|action:${actionKey(action)}`;
}

function outcomeKey(state) {
  return stableJson(stateProjection(state));
}

function hashBucket(value, salt = "learned-world-model-v1") {
  const digest = createHash("sha256").update(`${salt}:${String(value || "missing")}`).digest("hex");
  return parseInt(digest.slice(0, 8), 16) % 100;
}

export function assignTrajectorySplit(sessionId, {
  trainRatio = 0.7,
  validationRatio = 0.15,
  salt = "learned-world-model-v1",
} = {}) {
  const bucket = hashBucket(sessionId, salt);
  const trainCutoff = Math.round(Math.max(0, Math.min(1, trainRatio)) * 100);
  const validationCutoff = trainCutoff + Math.round(Math.max(0, Math.min(1, validationRatio)) * 100);
  if (bucket < trainCutoff) return "train";
  if (bucket < validationCutoff) return "validation";
  return "test";
}

function field(row, camel, snake = camel) {
  return row?.[camel] ?? row?.[snake];
}

function observedState(row) {
  return field(row, "observedState", "observed_state") || null;
}

function stateBefore(row) {
  return field(row, "stateBefore", "state_before") || null;
}

function proposedAction(row) {
  return field(row, "proposedAction", "proposed_action") ||
    field(row, "deterministicApprovedAction", "deterministic_approved_action") ||
    field(row, "plannerSelectedAction", "planner_selected_action") || null;
}

function eligibleRow(row, { includeSynthetic = false, includeTest = false } = {}) {
  const classification = String(field(row, "classification") || "").trim().toLowerCase();
  return Boolean(
    stateBefore(row) &&
    observedState(row) &&
    actionKey(proposedAction(row)) &&
    (includeSynthetic || field(row, "isSynthetic", "is_synthetic") !== true) &&
    (includeTest || field(row, "isTest", "is_test") !== true) &&
    classification !== "invalid_action" &&
    classification !== "unsupported"
  );
}

export function buildLearningExamples(rows = [], options = {}) {
  return rows
    .filter((row) => eligibleRow(row, options))
    .map((row) => {
      const before = stateBefore(row);
      const after = observedState(row);
      const sessionId = String(field(row, "sessionId", "session_id") || field(row, "trajectoryId", "trajectory_id") || "unknown");
      return {
        trajectoryId: String(field(row, "trajectoryId", "trajectory_id") || "").trim() || null,
        sessionId,
        split: assignTrajectorySplit(sessionId, options),
        stateBefore: stateProjection(before),
        action: actionKey(proposedAction(row)),
        observedState: stateProjection(after),
        outcome: outcomeKey(after),
      };
    });
}

function outcomeDistribution(counts, alpha = 1) {
  const entries = Object.entries(counts || {});
  const total = entries.reduce((sum, [, count]) => sum + Number(count || 0), 0);
  const denominator = total + entries.length * alpha;
  return entries
    .map(([outcome, count]) => ({
      state: JSON.parse(outcome),
      count,
      probability: denominator ? (Number(count) + alpha) / denominator : 0,
    }))
    .sort((left, right) => right.probability - left.probability);
}

export function trainLearnedWorldModel(rows = [], {
  alpha = 1,
  splitSalt = "learned-world-model-v1",
  trainRatio = 0.7,
  validationRatio = 0.15,
} = {}) {
  const examples = buildLearningExamples(rows, {
    salt: splitSalt,
    trainRatio,
    validationRatio,
  });
  const trainingExamples = examples.filter((example) => example.split === "train");
  const counts = new Map();

  for (const example of trainingExamples) {
    const key = transitionKey(example.stateBefore, example.action);
    const entry = counts.get(key) || {
      stateBefore: example.stateBefore,
      action: example.action,
      outcomes: {},
      observations: 0,
    };
    entry.outcomes[example.outcome] = (entry.outcomes[example.outcome] || 0) + 1;
    entry.observations += 1;
    counts.set(key, entry);
  }

  const transitions = [...counts.values()].map((entry) => ({
    key: transitionKey(entry.stateBefore, entry.action),
    stateBefore: entry.stateBefore,
    action: entry.action,
    observations: entry.observations,
    outcomes: outcomeDistribution(entry.outcomes, alpha),
  }));

  const splitCounts = examples.reduce((result, example) => {
    result[example.split] = (result[example.split] || 0) + 1;
    return result;
  }, {});
  const sessionCounts = [...new Set(examples.map((example) => example.sessionId))].reduce((result, sessionId) => {
    const split = assignTrajectorySplit(sessionId, { salt: splitSalt, trainRatio, validationRatio });
    result[split] = (result[split] || 0) + 1;
    return result;
  }, {});

  return {
    schemaVersion: LEARNED_WORLD_MODEL_SCHEMA_VERSION,
    modelVersion: LEARNED_WORLD_MODEL_VERSION,
    trainedAt: new Date().toISOString(),
    featureSchema: STATE_FIELDS,
    splitStrategy: "session_hash; no session is shared across splits",
    splitConfig: { trainRatio, validationRatio, salt: splitSalt },
    smoothing: { method: "laplace", alpha },
    training: {
      eligibleExamples: examples.length,
      trainingExamples: trainingExamples.length,
      splitCounts,
      sessionCounts,
      transitionCount: transitions.length,
    },
    transitions,
  };
}

export function predictLearnedNextStates(model, currentState, action, { topK = 3 } = {}) {
  if (!model || model.schemaVersion !== LEARNED_WORLD_MODEL_SCHEMA_VERSION) return [];
  const key = transitionKey(currentState, action);
  const transition = (model.transitions || []).find((item) => item.key === key);
  if (!transition) return [];
  const outcomes = Array.isArray(transition.outcomes) ? transition.outcomes : [];
  const observationConfidence = Math.min(0.99, transition.observations / (transition.observations + 5));
  return outcomes.slice(0, Math.max(1, topK)).map((outcome) => ({
    predictedState: clone(outcome.state),
    probability: Number(outcome.probability) || 0,
    confidence: observationConfidence,
    observations: transition.observations,
    evidence: "learned_transition_model",
    learned: true,
    modelVersion: model.modelVersion,
  }));
}

export function evaluateLearnedWorldModel(model, rows = [], { topK = 3, minimumSampleCount = 10 } = {}) {
  const examples = buildLearningExamples(rows, model?.splitConfig || {});
  const testExamples = examples.filter((example) => example.split === "test");
  let covered = 0;
  let top1Correct = 0;
  let topKCorrect = 0;
  let logLoss = 0;
  let brier = 0;

  for (const example of testExamples) {
    const predictions = predictLearnedNextStates(model, example.stateBefore, example.action, { topK });
    if (!predictions.length) continue;
    covered += 1;
    const top1 = predictions[0];
    const match = predictions.find((prediction) => outcomeKey(prediction.predictedState) === example.outcome);
    if (outcomeKey(top1.predictedState) === example.outcome) top1Correct += 1;
    if (match) topKCorrect += 1;
    const probability = Math.max(1e-9, match?.probability || 1e-9);
    logLoss += -Math.log(probability);
    const distribution = new Map(predictions.map((prediction) => [outcomeKey(prediction.predictedState), prediction.probability]));
    const seenOutcomes = new Set([...distribution.keys(), example.outcome]);
    brier += [...seenOutcomes].reduce((sum, outcome) => {
      const expected = outcome === example.outcome ? 1 : 0;
      return sum + ((distribution.get(outcome) || 0) - expected) ** 2;
    }, 0);
  }

  const sampleCount = testExamples.length;
  return {
    schemaVersion: LEARNED_WORLD_MODEL_SCHEMA_VERSION,
    evaluationType: "learned_structured_transition_model",
    modelVersion: model?.modelVersion || null,
    split: "session_hash:test",
    sampleCount,
    coveredSamples: covered,
    coverage: sampleCount ? covered / sampleCount : 0,
    metrics: {
      nextStateAccuracy: sampleCount ? top1Correct / sampleCount : 0,
      topKStateAccuracy: sampleCount ? topKCorrect / sampleCount : 0,
      coveredNextStateAccuracy: covered ? top1Correct / covered : 0,
      logLoss: covered ? logLoss / covered : null,
      brierScore: covered ? brier / covered : null,
    },
    meaningful: sampleCount >= minimumSampleCount,
    limitations: [
      "This is a structured transition learner, not a neural foundation model.",
      "Metrics are not production claims until the minimum session-isolated test count is reached.",
      "The learned prediction is shadow-only and cannot authorize execution.",
    ],
  };
}

export function validateLearnedWorldModel(model) {
  return Boolean(
    model &&
    model.schemaVersion === LEARNED_WORLD_MODEL_SCHEMA_VERSION &&
    model.modelVersion === LEARNED_WORLD_MODEL_VERSION &&
    Array.isArray(model.featureSchema) &&
    Array.isArray(model.transitions)
  );
}

export function loadLearnedWorldModel(filePath, readFileSync = null) {
  if (!filePath || typeof readFileSync !== "function") return null;
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    return validateLearnedWorldModel(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
