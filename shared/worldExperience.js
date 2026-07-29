import { simulateAction, simulatePlan, scoreWorldPlan } from "./worldSimulator.js";

export const WORLD_EXPERIENCE_SCHEMA_VERSION = "1.0";
export const MIN_EXPERIENCE_OBSERVATIONS = 3;
const DIRICHLET_ALPHA = 1;

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizePortal(value) {
  return normalizeToken(value).replace("meet_joz", "meet-joz");
}

function normalizeAction(action) {
  if (typeof action === "string") return normalizeToken(action);
  return normalizeToken(action?.type || action?.action || action?.id);
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeExperienceRow(row = {}) {
  const source = row && typeof row === "object" ? row : {};
  const attempts = Math.max(0, Math.round(numeric(source.attempts)));
  const successes = Math.max(0, Math.min(attempts, Math.round(numeric(source.successes))));
  const failures = Math.max(0, attempts - successes);
  return {
    stateKey: normalizeToken(source.stateKey || source.state_key),
    actionKey: normalizeAction(source.actionKey || source.action_key),
    nextStateKey: normalizeToken(source.nextStateKey || source.next_state_key),
    nextPortal: normalizeToken(source.nextPortal || source.next_portal).replace("meet_joz", "meet-joz") || null,
    nextStage: normalizeToken(source.nextStage || source.next_stage) || null,
    targetRoute: String(source.targetRoute || source.target_route || "").trim() || null,
    attempts,
    successes,
    failures,
    averageDurationMs: Math.max(0, numeric(source.averageDurationMs || source.average_duration_ms)),
    averagePredictionError: clamp(source.averagePredictionError || source.average_prediction_error),
    lastObservedAt: source.lastObservedAt || source.last_observed_at || null,
  };
}

function outcomeKey(state = {}) {
  const stateKey = state.currentStateKey || "";
  return stateKey
    ? `state:${stateKey}|portal:${normalizePortal(state.portal)}`
    : `portal:${normalizePortal(state.portal)}|stage:${state.stage || ""}`;
}

function applyExperienceOutcome(baseState, row) {
  const predictedState = clone(baseState) || {};
  if (row.nextStateKey) predictedState.currentStateKey = row.nextStateKey;
  if (row.nextPortal) predictedState.portal = row.nextPortal;
  if (row.nextStage) predictedState.stage = row.nextStage;
  if (row.targetRoute) predictedState.targetRoute = row.targetRoute;
  if (predictedState.portal) {
    predictedState.visitedPortalIds = [
      ...new Set([...(predictedState.visitedPortalIds || []), predictedState.portal]),
    ];
  }
  return predictedState;
}

function normalizeProbabilities(outcomes = []) {
  const total = outcomes.reduce((sum, outcome) => sum + Math.max(0, numeric(outcome.probability)), 0);
  if (!total) return outcomes.map((outcome) => ({ ...outcome, probability: 0 }));
  return outcomes.map((outcome) => ({
    ...outcome,
    probability: Math.max(0, numeric(outcome.probability)) / total,
  }));
}

export function predictNextStates(currentState, action, {
  transitions = [],
  experienceRows = [],
  minObservations = MIN_EXPERIENCE_OBSERVATIONS,
} = {}) {
  const symbolic = simulateAction(currentState, action, { transitions });
  const normalizedRows = experienceRows
    .map(normalizeExperienceRow)
    .filter((row) => row.actionKey === normalizeAction(action) && row.attempts > 0);
  const totalAttempts = normalizedRows.reduce((sum, row) => sum + row.attempts, 0);

  if (totalAttempts < minObservations) {
    return [{
      predictedState: symbolic.predictedState,
      probability: 1,
      expectedEffects: symbolic.expectedEffects,
      expectedDurationMs: null,
      successProbability: symbolic.valid ? 0.95 : 0,
      risk: symbolic.valid ? 0 : 1,
      confidence: clamp(0.35 + totalAttempts * 0.05, 0.35, 0.7),
      evidence: "symbolic_transition_fallback",
      symbolic: true,
      violations: symbolic.violations,
    }];
  }

  const outcomes = normalizedRows.map((row) => ({
    predictedState: applyExperienceOutcome(symbolic.predictedState, row),
    probability: row.attempts + DIRICHLET_ALPHA,
    expectedEffects: symbolic.expectedEffects,
    expectedDurationMs: row.averageDurationMs || null,
    successProbability: (row.successes + DIRICHLET_ALPHA) /
      (row.attempts + DIRICHLET_ALPHA * 2),
    risk: row.failures / Math.max(1, row.attempts),
    confidence: clamp(0.4 + Math.log1p(row.attempts) / 5, 0.4, 0.95),
    evidence: "persisted_transition_experience",
    symbolic: false,
    violations: symbolic.violations,
  }));

  const symbolicOutcomeKey = outcomeKey(symbolic.predictedState);
  if (!outcomes.some((outcome) => outcomeKey(outcome.predictedState) === symbolicOutcomeKey)) {
    outcomes.push({
      predictedState: symbolic.predictedState,
      probability: DIRICHLET_ALPHA,
      expectedEffects: symbolic.expectedEffects,
      expectedDurationMs: null,
      successProbability: symbolic.valid ? 0.95 : 0,
      risk: symbolic.valid ? 0 : 1,
      confidence: 0.5,
      evidence: "symbolic_prior",
      symbolic: true,
      violations: symbolic.violations,
    });
  }

  return normalizeProbabilities(outcomes);
}

export function simulateTrajectory(initialState, actionSequence = [], {
  transitions = [],
  experienceByAction = {},
  maxDepth = 4,
  maxBranches = 32,
} = {}) {
  const actions = Array.isArray(actionSequence) ? actionSequence.slice(0, maxDepth) : [];
  let branches = [{
    state: clone(initialState),
    probability: 1,
    successProbability: 1,
    risk: 0,
    durationMs: 0,
    trajectory: [],
  }];

  for (const action of actions) {
    const nextBranches = [];
    for (const branch of branches) {
      const outcomes = predictNextStates(branch.state, action, {
        transitions,
        experienceRows: experienceByAction[normalizeAction(action)] || [],
      });

      for (const outcome of outcomes) {
        const probability = branch.probability * outcome.probability;
        const trajectory = [
          ...branch.trajectory,
          {
            action: typeof action === "string" ? action : clone(action),
            predictedState: outcome.predictedState,
            probability: outcome.probability,
            expectedEffects: outcome.expectedEffects,
            expectedDurationMs: outcome.expectedDurationMs,
            successProbability: outcome.successProbability,
            risk: outcome.risk,
            confidence: outcome.confidence,
            evidence: outcome.evidence,
            violations: outcome.violations,
          },
        ];
        nextBranches.push({
          state: outcome.predictedState,
          probability,
          successProbability: branch.successProbability * outcome.successProbability,
          risk: 1 - (1 - branch.risk) * (1 - outcome.risk),
          durationMs: branch.durationMs + (outcome.expectedDurationMs || 0),
          trajectory,
        });
      }
    }

    branches = nextBranches
      .sort((left, right) => right.probability - left.probability)
      .slice(0, maxBranches);
    if (!branches.length) break;
  }

  const probabilityTotal = branches.reduce((sum, branch) => sum + branch.probability, 0);
  const normalizedBranches = probabilityTotal
    ? branches.map((branch) => ({ ...branch, probability: branch.probability / probabilityTotal }))
    : branches;
  const mostLikely = normalizedBranches[0] || null;

  return {
    initialState: clone(initialState),
    actions: clone(actions),
    branches: normalizedBranches,
    predictedState: mostLikely?.state || clone(initialState),
    trajectory: mostLikely?.trajectory || [],
    successProbability: normalizedBranches.reduce(
      (sum, branch) => sum + branch.probability * branch.successProbability,
      0
    ),
    expectedRisk: normalizedBranches.reduce((sum, branch) => sum + branch.probability * branch.risk, 0),
    expectedDurationMs: normalizedBranches.reduce((sum, branch) => sum + branch.probability * branch.durationMs, 0),
    uncertainty: normalizedBranches.length > 1 ? 1 - normalizedBranches[0].probability : 0,
    valid: normalizedBranches.every((branch) => branch.trajectory.every((step) => !step.violations.length)),
  };
}

export function scoreProbabilisticPlan(initialState, probabilisticSimulation, goal = "") {
  const symbolic = {
    predictedState: probabilisticSimulation?.predictedState || initialState,
    trajectory: probabilisticSimulation?.trajectory || [],
    valid: probabilisticSimulation?.valid !== false,
  };
  const baseScore = scoreWorldPlan(initialState, symbolic, goal);
  const successProbability = clamp(probabilisticSimulation?.successProbability, 0, 1);
  const uncertainty = clamp(probabilisticSimulation?.uncertainty, 0, 1);
  const risk = clamp(probabilisticSimulation?.expectedRisk, 0, 1);
  const total =
    baseScore.total +
    successProbability * 0.25 -
    risk * 0.2 -
    uncertainty * 0.15;

  return {
    ...baseScore,
    successProbability,
    expectedRisk: risk,
    uncertainty,
    expectedDurationMs: probabilisticSimulation?.expectedDurationMs || 0,
    total,
  };
}

export function evaluateProbabilisticPlans(initialState, candidatePlans = [], goal = "", context = {}) {
  return (Array.isArray(candidatePlans) ? candidatePlans : []).map((plan) => {
    const actions = Array.isArray(plan) ? plan : plan?.actions || [];
    const probabilisticSimulation = simulateTrajectory(initialState, actions, context);
    return {
      plan: Array.isArray(plan) ? { actions } : clone(plan),
      probabilisticSimulation,
      score: scoreProbabilisticPlan(initialState, probabilisticSimulation, goal),
    };
  });
}

export function normalizeExperienceRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeExperienceRow)
    .filter((row) => row.actionKey && row.attempts >= 0);
}

export function calculateBrierScore(predictions = []) {
  const values = Array.isArray(predictions) ? predictions : [];
  if (!values.length) return null;
  return values.reduce((sum, item) => {
    const probability = clamp(item.probability);
    const outcome = item.outcome ? 1 : 0;
    return sum + (probability - outcome) ** 2;
  }, 0) / values.length;
}

export function calculateExpectedCalibrationError(predictions = [], bins = 10) {
  const values = Array.isArray(predictions) ? predictions : [];
  if (!values.length) return null;
  const buckets = Array.from({ length: bins }, () => []);
  for (const prediction of values) {
    const index = Math.min(bins - 1, Math.floor(clamp(prediction.probability) * bins));
    buckets[index].push(prediction);
  }
  return buckets.reduce((sum, bucket) => {
    if (!bucket.length) return sum;
    const confidence = bucket.reduce((total, item) => total + clamp(item.probability), 0) / bucket.length;
    const accuracy = bucket.reduce((total, item) => total + (item.outcome ? 1 : 0), 0) / bucket.length;
    return sum + (bucket.length / values.length) * Math.abs(confidence - accuracy);
  }, 0);
}
