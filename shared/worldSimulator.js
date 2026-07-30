const ACTION_TARGETS = {
  brain: { portal: "maxx", target: "/neo/maxx" },
  go_maxx_via_enter: { portal: "maxx", target: "/neo/maxx" },
  go_maxx_via_brain: { portal: "maxx", target: "/neo/maxx" },
  ball: { portal: "meet_joz", target: "/neo/meet-joz" },
  go_meet_joz: { portal: "meet_joz", target: "/neo/meet-joz" },
  back: { portal: "root", target: "/" },
  vibe_back: { portal: "root", target: "/" },
  vibe_back1: { portal: "meet_joz", stage: "discover" },
  vibe: { portal: "meet_joz", stage: "vibe" },
  discover: { portal: "meet_joz", stage: "discover" },
  skills: { portal: "meet_joz", stage: "skills" },
  show_flex: { portal: "meet_joz", stage: "vibe" },
  show_ascend: { portal: "meet_joz", stage: "discover" },
  show_mogg: { portal: "meet_joz", stage: "skills" },
  show_skills_layer: { portal: "meet_joz", stage: "skills" },
};

const ACTION_ALIASES = {
  n2x_pause: "pause",
  pause_neurons: "pause",
  pause: "pause",
  n2x_resume: "resume",
  resume_neurons: "resume",
  resume: "resume",
  launch_in_space_n2x: "launch_ar",
  launch_in_space_workf: "launch_ar",
};

const TOKEN_RE = /[a-z0-9]+/g;

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeAction(action) {
  if (typeof action === "string") return normalizeToken(action);
  return normalizeToken(action?.type || action?.action || action?.id);
}

function normalizeTarget(action) {
  if (!action || typeof action === "string") return null;
  return String(action.target || action.targetRoute || "").trim() || null;
}

function toArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function portalFromTarget(target = "") {
  const normalized = normalizeToken(target);
  if (normalized.includes("maxx")) return "maxx";
  if (normalized.includes("meet-joz") || normalized.includes("meet_joz")) return "meet_joz";
  if (normalized === "/" || normalized === "root") return "root";
  return null;
}

function stateTerms(state = {}) {
  return [
    state.portal,
    state.stage,
    state.currentStateKey,
    state.focusedEntityId,
    ...toArray(state.visibleEntityIds),
    ...toArray(state.availableActionIds),
    state.environment?.meshStates?.currentMesh,
    state.environment?.meshStates?.currentStage,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .match(TOKEN_RE) || [];
}

function goalTerms(goal = "") {
  return String(goal || "").toLowerCase().match(TOKEN_RE) || [];
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

function transitionForAction(state, action, transitions = []) {
  const normalizedAction = normalizeAction(action);
  return toArray(transitions).find(
    (transition) => normalizeAction(transition?.action) === normalizedAction
  ) || null;
}

export function buildCanonicalWorldState({
  appContext = {},
  legacyContext = {},
  structuredState = null,
  userContext = {},
  timestamp = Date.now(),
} = {}) {
  const currentPortal = normalizeToken(
    appContext.current_portal || legacyContext.currentPortal || legacyContext.portal || "root"
  ).replace("meet_joz", "meet-joz");
  const currentMesh = normalizeToken(legacyContext.currentMesh || legacyContext.mesh || "") || null;
  const currentStage = normalizeToken(
    appContext.current_stage || legacyContext.currentMeshStage || legacyContext.stage || ""
  ) || null;
  const availableActionIds = toArray(
    appContext.available_actions || legacyContext.allowedActions || structuredState?.availableActions
  ).map(normalizeAction).filter(Boolean);
  const visitedPortalIds = toArray(appContext.visited_portals || legacyContext.visitedPortals)
    .map((value) => normalizeToken(value).replace("meet_joz", "meet-joz"))
    .filter(Boolean);

  return {
    schemaVersion: 1,
    portal: currentPortal || "root",
    sequence: appContext.current_sequence || null,
    stage: currentStage,
    currentStateKey: structuredState?.state?.state_key || currentStage || currentMesh || currentPortal || "root",
    focusedEntityId: appContext.focused_object || null,
    visibleEntityIds: toArray(appContext.visible_objects),
    visitedPortalIds: [...new Set(["root", ...visitedPortalIds, currentPortal].filter(Boolean))],
    userContext: clone(userContext) || {},
    environment: {
      meshStates: {
        currentMesh,
        currentStage,
        currentPhase: legacyContext.currentPhase || legacyContext.voiceState?.currentPhase || null,
      },
      camera: clone(appContext.camera || legacyContext.camera || {}) || {},
      activeOverlays: toArray(appContext.active_overlays || legacyContext.activeOverlays),
    },
    constraints: toArray(legacyContext.constraints || appContext.constraints),
    availableActionIds,
    lastAction: appContext.previous_action || legacyContext.previousAction || null,
    timestamp,
  };
}

export function transitionWorldState(state = {}, action, { transitions = [] } = {}) {
  const normalizedAction = normalizeAction(action);
  const target = normalizeTarget(action);
  const nextState = clone(state) || {};
  const violations = [];
  const effects = [];

  if (!normalizedAction) {
    return { nextState, effects, valid: false, violations: ["ACTION_MISSING"] };
  }

  const allowed = toArray(state.availableActionIds).map(normalizeAction).filter(Boolean);
  if (allowed.length && !allowed.includes(normalizedAction)) {
    return {
      nextState: clone(state) || {},
      effects,
      valid: false,
      violations: ["ACTION_NOT_ALLOWED"],
      transition: null,
    };
  }

  const transition = transitionForAction(state, normalizedAction, transitions);
  const rule = ACTION_TARGETS[normalizedAction] || {};
  const nextPortal = portalFromTarget(target) || transition?.target && portalFromTarget(transition.target) || rule.portal;
  const nextStage = transition?.nextStateKey || rule.stage || state.stage || null;

  if (transition?.target && target && transition.target !== target) {
    return {
      nextState: clone(state) || {},
      effects,
      valid: false,
      violations: ["TARGET_DOES_NOT_MATCH_TRANSITION"],
      transition: null,
    };
  }

  nextState.currentStateKey =
    transition?.nextStateKey || rule.stage || rule.portal || state.currentStateKey || state.portal;
  if (nextPortal) {
    nextState.portal = nextPortal;
    nextState.visitedPortalIds = [...new Set([
      ...toArray(nextState.visitedPortalIds),
      nextPortal,
    ])];
  }
  if (nextStage) nextState.stage = nextStage;
  if (target) nextState.targetRoute = target;
  nextState.lastAction = normalizedAction;
  nextState.timestamp = state.timestamp;

  const actionKind = ACTION_ALIASES[normalizedAction];
  if (actionKind === "pause" || actionKind === "resume") {
    nextState.environment = nextState.environment || {};
    nextState.environment.meshStates = nextState.environment.meshStates || {};
    nextState.environment.meshStates.paused = actionKind === "pause";
    effects.push({ type: actionKind === "pause" ? "pause_motion" : "resume_motion" });
  }
  if (actionKind === "launch_ar") {
    nextState.environment = nextState.environment || {};
    nextState.environment.activeOverlays = [
      ...new Set([...toArray(nextState.environment.activeOverlays), "ar"]),
    ];
    effects.push({ type: "launch_ar", action: normalizedAction });
  }
  if (nextPortal && nextPortal !== state.portal) {
    effects.push({ type: "navigate", target: target || nextPortal });
  }
  if (nextStage && nextStage !== state.stage) {
    effects.push({ type: "focus_stage", stage: nextStage });
  }

  return {
    nextState,
    effects,
    valid: violations.length === 0,
    violations,
    transition: transition
      ? {
          nextStateKey: transition.nextStateKey || null,
          target: transition.target || null,
          awareness: transition.awareness || null,
        }
      : null,
  };
}

export function simulateAction(currentState, action, options = {}) {
  const result = transitionWorldState(currentState, action, options);
  return {
    action: typeof action === "string" ? action : clone(action),
    predictedState: result.nextState,
    expectedEffects: result.effects,
    violations: result.violations,
    valid: result.valid,
    confidence: result.valid ? (result.transition ? 0.95 : 0.8) : 0,
    transition: result.transition,
  };
}

export function simulatePlan(initialState, actions = [], options = {}) {
  let predictedState = clone(initialState) || {};
  const trajectory = [];

  for (const action of toArray(actions)) {
    const result = simulateAction(predictedState, action, options);
    trajectory.push(result);
    if (!result.valid) break;
    predictedState = result.predictedState;
  }

  return {
    initialState: clone(initialState),
    predictedState,
    trajectory,
    valid: trajectory.every((step) => step.valid),
    violations: trajectory.flatMap((step) => step.violations),
  };
}

export function scoreWorldPlan(initialState, simulation, goal = "") {
  const desired = new Set(goalTerms(goal));
  const future = new Set([
    ...stateTerms(simulation?.predictedState),
    ...simulation?.trajectory?.flatMap((step) => [normalizeAction(step.action), ...step.expectedEffects.map((effect) => effect.type)]) || [],
  ]);
  const matchedTerms = [...desired].filter((term) => future.has(term));
  const relevance = desired.size ? matchedTerms.length / desired.size : 0.5;
  const goalProgress = relevance > 0 ? Math.min(1, relevance + 0.25) : 0;
  const transitionCost = Math.max(0, (simulation?.trajectory?.length || 0) - 1) * 0.1;
  const risk = simulation?.valid ? 0 : 1;
  const userDisruption = simulation?.trajectory?.some((step) =>
    ["back", "vibe_back", "vibe_back1"].includes(normalizeAction(step.action))
  ) ? 0.25 : 0;
  const confidence = simulation?.trajectory?.length
    ? simulation.trajectory.reduce((sum, step) => sum + step.confidence, 0) / simulation.trajectory.length
    : 0;
  const evidenceQuality = Math.min(
    1,
    (simulation?.predictedState?.focusedEntityId ? 0.5 : 0) +
      Math.min(0.5, (simulation?.predictedState?.visibleEntityIds?.length || 0) * 0.1)
  );
  const total =
    goalProgress * 0.45 +
    relevance * 0.3 +
    evidenceQuality * 0.1 +
    confidence * 0.25 -
    transitionCost -
    userDisruption -
    risk;

  return {
    goalProgress,
    relevance,
    evidenceQuality,
    transitionCost,
    userDisruption,
    risk,
    confidence,
    matchedTerms,
    total,
  };
}

export function chooseWorldPlan(initialState, candidatePlans = [], goal = "") {
  const evaluated = evaluateWorldPlans(initialState, candidatePlans, goal);

  return evaluated
    .filter((candidate) => candidate.simulation.valid)
    .sort((left, right) => right.score.total - left.score.total)[0] || null;
}

export function evaluateWorldPlans(initialState, candidatePlans = [], goal = "") {
  return toArray(candidatePlans).map((plan) => {
    const actions = Array.isArray(plan) ? plan : plan?.actions || [];
    const simulation = simulatePlan(initialState, actions, {
      transitions: plan?.transitions || [],
    });
    return {
      plan: Array.isArray(plan) ? { actions } : clone(plan),
      simulation,
      score: scoreWorldPlan(initialState, simulation, goal),
    };
  });
}

export function compareWorldStates(predictedState = {}, observedState = {}) {
  const fields = [
    "portal",
    "sequence",
    "stage",
    "currentStateKey",
    "focusedEntityId",
    "visibleEntityIds",
    "visitedPortalIds",
  ];
  const differences = [];

  for (const field of fields) {
    const predictedValue = comparableStateValue(field, predictedState?.[field]);
    const observedValue = comparableStateValue(field, observedState?.[field]);
    const predicted = JSON.stringify(predictedValue);
    const observed = JSON.stringify(observedValue);
    if (predicted !== observed) differences.push({ field, predicted: predictedState?.[field] ?? null, observed: observedState?.[field] ?? null });
  }

  return {
    matches: differences.length === 0,
    differences,
    errorCount: differences.length,
  };
}

export function buildPredictionTrace({
  input = "",
  trajectoryId = null,
  sessionId = null,
  traceId = trajectoryId,
  interactionChannel = "voice",
  goal = "world_navigation",
  modelVersion = "symbolic-v1",
  transitionRuleVersion = "meetjoz-world-v1",
  initialState,
  candidatePlans = [],
  selectedPlan = null,
  plannerSelectedPlan = null,
  probabilisticCandidates = [],
  probabilisticSelected = null,
  probabilisticPlannerSelected = null,
  observedState = null,
  observationBefore = null,
  shadowLatencyMs = null,
  learnedTransitionModel = null,
} = {}) {
  const comparison = selectedPlan && observedState
    ? compareWorldStates(selectedPlan.simulation.predictedState, observedState)
    : null;

  const serializeSelectedPlan = (plan) => plan
    ? {
        actions: plan.plan?.actions || [],
        predictedState: plan.simulation.predictedState,
        expectedEffects: plan.simulation.trajectory?.flatMap(
          (step) => step.expectedEffects || []
        ) || [],
        predictedObservation: plan.predictedObservation?.predictedObservation || null,
        confidence: plan.simulation.trajectory?.[0]?.confidence ?? null,
        score: plan.score,
      }
    : null;

  return {
    version: 1,
    trajectoryId,
    sessionId,
    traceId,
    interactionChannel,
    goal,
    modelVersion,
    transitionRuleVersion,
    input: String(input || ""),
    initialState: clone(initialState),
    observationBefore: clone(observationBefore),
    shadowLatencyMs: Number.isFinite(Number(shadowLatencyMs)) ? Math.max(0, Math.round(Number(shadowLatencyMs))) : null,
    candidateCount: candidatePlans.length,
    candidates: candidatePlans.map((candidate) => ({
      actions: candidate.actions || candidate.plan?.actions || [],
      score: candidate.score || null,
      valid: candidate.simulation?.valid !== false,
      violations: candidate.simulation?.violations || [],
    })),
    selected: serializeSelectedPlan(selectedPlan),
    plannerSelected: serializeSelectedPlan(plannerSelectedPlan),
    probabilistic: {
      candidateCount: probabilisticCandidates.length,
      candidates: probabilisticCandidates.map((candidate) => ({
        actions: candidate.plan?.actions || [],
        score: candidate.score || null,
        successProbability: candidate.probabilisticSimulation?.successProbability ?? null,
        expectedRisk: candidate.probabilisticSimulation?.expectedRisk ?? null,
        uncertainty: candidate.probabilisticSimulation?.uncertainty ?? null,
        branches: (candidate.probabilisticSimulation?.branches || []).slice(0, 5).map((branch) => ({
          probability: branch.probability,
          state: branch.state,
          successProbability: branch.successProbability,
          risk: branch.risk,
        })),
      })),
      selected: probabilisticSelected
        ? {
            actions: probabilisticSelected.plan?.actions || [],
            score: probabilisticSelected.score,
            successProbability: probabilisticSelected.probabilisticSimulation?.successProbability ?? null,
            expectedRisk: probabilisticSelected.probabilisticSimulation?.expectedRisk ?? null,
            uncertainty: probabilisticSelected.probabilisticSimulation?.uncertainty ?? null,
            predictedObservation: probabilisticSelected.predictedObservation?.predictedObservation || null,
        }
        : null,
      plannerSelected: probabilisticPlannerSelected
        ? {
            actions: probabilisticPlannerSelected.plan?.actions || [],
            score: probabilisticPlannerSelected.score,
            successProbability: probabilisticPlannerSelected.probabilisticSimulation?.successProbability ?? null,
            expectedRisk: probabilisticPlannerSelected.probabilisticSimulation?.expectedRisk ?? null,
            uncertainty: probabilisticPlannerSelected.probabilisticSimulation?.uncertainty ?? null,
            predictedObservation: probabilisticPlannerSelected.predictedObservation?.predictedObservation || null,
          }
        : null,
    },
    observedState: clone(observedState),
    predictionError: comparison,
    learnedTransitionModel: learnedTransitionModel
      ? {
          enabled: learnedTransitionModel.enabled === true,
          loaded: learnedTransitionModel.loaded === true,
          modelVersion: learnedTransitionModel.modelVersion || null,
          candidates: Array.isArray(learnedTransitionModel.candidates)
            ? learnedTransitionModel.candidates.slice(0, 24).map((candidate) => ({
                action: candidate.action || null,
                predictedState: clone(candidate.predictedState),
                probability: candidate.probability ?? null,
                confidence: candidate.confidence ?? null,
                observations: candidate.observations ?? null,
                evidence: candidate.evidence || null,
                learned: candidate.learned === true,
                modelVersion: candidate.modelVersion || null,
              }))
            : [],
        }
      : {
          enabled: false,
          loaded: false,
          modelVersion: null,
          candidates: [],
        },
  };
}
