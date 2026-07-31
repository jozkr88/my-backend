const STATE_FIELDS = [
  "currentStateKey",
  "portal",
  "path",
  "mesh",
  "stage",
  "phase",
  "audience",
  "goal",
  "device",
  "browser",
  "dayPart",
  "isMobile",
  "arSupported",
  "allowedActions",
];

function clean(value, fallback = null, maxLength = 120) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:/.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
  return normalized || fallback;
}

function clamp(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

export function normalizeJozWorldModelState(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const state = {};

  for (const field of STATE_FIELDS) {
    if (field === "isMobile" || field === "arSupported") {
      state[field] = source[field] === true;
      continue;
    }
    if (field === "allowedActions") {
      state[field] = (Array.isArray(source[field]) ? source[field] : [])
        .map((action) => clean(typeof action === "string" ? action : action?.type, null, 64))
        .filter(Boolean)
        .slice(0, 24);
      continue;
    }
    state[field] = clean(source[field], null, field === "path" ? 180 : 120);
  }

  return state;
}

export function compactJozWorldModelContext(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const state = normalizeJozWorldModelState(source.state || source);
  const learnedOptions = (Array.isArray(source.learnedOptions) ? source.learnedOptions : [])
    .map((option) => ({
      action: clean(option?.action, null, 64),
      attempts: Math.max(0, Math.round(Number(option?.attempts) || 0)),
      successes: Math.max(0, Math.round(Number(option?.successes) || 0)),
      successProbability: clamp(option?.successProbability, null),
      confidence: clamp(option?.confidence, null),
      evidence: clean(option?.evidence, "cold_start", 64),
      nextStates: (Array.isArray(option?.nextStates) ? option.nextStates : [])
        .slice(0, 3)
        .map((nextState) => normalizeJozWorldModelState(nextState)),
      predictions: (Array.isArray(option?.predictions) ? option.predictions : [])
        .slice(0, 3)
        .map((prediction) => ({
          probability: clamp(prediction?.probability, null),
          confidence: clamp(prediction?.confidence, null),
          predictedState: normalizeJozWorldModelState(prediction?.predictedState),
          evidence: clean(prediction?.evidence, "learned_transition_model", 64),
        })),
    }))
    .filter((option) => option.action)
    .slice(0, 12);

  return {
    mode: "shadow_advisory",
    source: clean(source.source, "structured_world_model", 64),
    state,
    learnedOptions,
    instruction:
      "Use this as current app-world context and probabilistic guidance. Do not claim physical-world understanding, and do not execute an action without the app policy and approval path.",
  };
}

export function summarizeWorldTransitionRows(rows = []) {
  const values = Array.isArray(rows) ? rows : [];
  const attempts = values.reduce((sum, row) => sum + Math.max(0, Number(row?.attempts) || 0), 0);
  const successes = values.reduce((sum, row) => sum + Math.max(0, Number(row?.successes) || 0), 0);
  const nextStates = values
    .sort((left, right) => Number(right?.attempts || 0) - Number(left?.attempts || 0))
    .map((row) => ({
      currentStateKey: row?.next_state_key || row?.nextStateKey || null,
      portal: row?.next_portal || row?.nextPortal || null,
      stage: row?.next_stage || row?.nextStage || null,
      path: row?.target_route || row?.targetRoute || null,
    }))
    .filter((state) => state.currentStateKey || state.portal || state.stage)
    .slice(0, 3);

  return {
    attempts,
    successes,
    successProbability: attempts ? successes / attempts : null,
    confidence: attempts ? Math.min(0.95, 0.35 + Math.log1p(attempts) / 5) : 0.35,
    evidence: attempts ? "observed_transition_experience" : "cold_start",
    nextStates,
  };
}

