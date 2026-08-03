import { CURRENT_DATE, INITIAL_WORLD, SCENARIOS } from "./seedWorld";

export const DEFAULT_OBJECTIVE = {
  id: "atlas-release-objective",
  label: "Release by 15 September without increasing defect risk above 15%.",
  primaryMetric: "predictedReleaseDate",
  optimization: "target",
  targetValue: "2026-09-15",
  constraints: [
    { metric: "additionalCost", operator: "less_than_or_equal", value: 40000 },
    { metric: "defectRisk", operator: "less_than_or_equal", value: 0.15 },
  ],
  weights: { onTimeProbability: 0.35, targetDate: 0.35, renewalProbability: 0.2, defectRisk: 0.1 },
};

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const clone = (value) => JSON.parse(JSON.stringify(value));

function isoDate(value = CURRENT_DATE) {
  if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) return String(value);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "2026-07-31" : parsed.toISOString().slice(0, 10);
}

function addDays(dateValue, days) {
  const date = new Date(`${isoDate(dateValue)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function makeState(data, version = "v0", kind = "observed", timestamp = CURRENT_DATE, sourceEventIds = []) {
  return {
    id: "project-atlas",
    version,
    timestamp,
    kind,
    data: clone(data),
    metrics: clone(data),
    relationships: ["scope→backend", "backend→critical-path", "critical-path→release", "release→customer"],
    risks: ["delivery", "quality", "customer"].map((id) => ({ id, value: data.risk[id] || 0 })),
    sourceEventIds: [...sourceEventIds],
  };
}

export function createInitialWorldState() {
  return makeState(INITIAL_WORLD);
}

function applyEventData(data, event) {
  const next = clone(data);
  const payload = event.payload || {};
  const count = Number(payload.count) || 1;

  if (event.type === "people_hired") {
    next.team.engineers += count;
    next.team.capacityUtilization = clamp(next.team.capacityUtilization - count * 0.035, 0.55, 1);
    next.team.backendCapacityGap = clamp(next.team.backendCapacityGap - count * 0.065, 0, 1);
    next.team.reviewLatencyIncrease = clamp(next.team.reviewLatencyIncrease - count * 0.025, 0, 1);
    next.project.onTimeProbability = clamp(next.project.onTimeProbability + count * 0.055);
    next.project.estimatedCost += count * 45000;
    next.risk.delivery = clamp(next.risk.delivery - count * 0.045);
    next.risk.overall = clamp(next.risk.overall - count * 0.03);
    next.customer.renewalProbability = clamp(next.customer.renewalProbability + count * 0.018);
  }

  if (event.type === "backend_tasks_blocked") {
    next.project.blockedWorkRatio = clamp(next.project.blockedWorkRatio + count * 0.03);
    next.project.remainingEffortHours += count * 20;
    next.team.backendCapacityGap = clamp(next.team.backendCapacityGap + count * 0.018);
    next.team.reviewLatencyIncrease = clamp(next.team.reviewLatencyIncrease + count * 0.035);
    next.project.onTimeProbability = clamp(next.project.onTimeProbability - count * 0.035);
    next.risk.delivery = clamp(next.risk.delivery + count * 0.045);
    next.risk.overall = clamp(next.risk.overall + count * 0.03);
  }

  if (event.type === "scope_growth") {
    const percentage = Number(payload.percentage) || 20;
    const ratio = percentage / 100;
    next.project.scopeGrowthRate += ratio;
    next.project.remainingEffortHours = Math.round(next.project.remainingEffortHours * (1 + ratio * 0.9));
    next.project.onTimeProbability = clamp(next.project.onTimeProbability - ratio * 0.5);
    next.project.predictedReleaseDate = addDays(next.project.predictedReleaseDate, Math.round(percentage * 0.6));
    next.team.capacityUtilization = clamp(next.team.capacityUtilization + ratio * 0.5);
    next.team.backendCapacityGap = clamp(next.team.backendCapacityGap + ratio * 0.35);
    next.risk.delivery = clamp(next.risk.delivery + ratio * 0.28);
    next.risk.overall = clamp(next.risk.overall + ratio * 0.2);
    next.customer.sentiment = clamp(next.customer.sentiment - ratio * 0.3);
    next.customer.renewalProbability = clamp(next.customer.renewalProbability - ratio * 0.25);
  }

  if (event.type === "people_departed") {
    next.team.engineers = Math.max(1, next.team.engineers - count);
    next.team.capacityUtilization = clamp(next.team.capacityUtilization + count * 0.045);
    next.team.backendCapacityGap = clamp(next.team.backendCapacityGap + count * 0.08);
    next.project.onTimeProbability = clamp(next.project.onTimeProbability - count * 0.07);
    next.risk.delivery = clamp(next.risk.delivery + count * 0.06);
    next.risk.overall = clamp(next.risk.overall + count * 0.045);
  }

  if (event.type === "release_date_moved" && payload.date) {
    next.project.plannedReleaseDate = isoDate(payload.date);
    next.project.predictedReleaseDate = isoDate(payload.date);
  }

  return next;
}

export function applyObservedEvent(state, event) {
  const nextData = applyEventData(state.data || state.metrics || INITIAL_WORLD, event);
  return makeState(nextData, event.resultingStateVersion || state.version, "observed", event.timestamp || state.timestamp, [...(state.sourceEventIds || []), event.id]);
}

export function encodeState(events = [], baseWorld = INITIAL_WORLD) {
  let state = makeState(baseWorld);
  events.forEach((event, index) => {
    state = applyObservedEvent(state, {
      ...event,
      previousStateVersion: state.version,
      resultingStateVersion: `v${index + 1}`,
    });
  });
  return state;
}

function applyScenarioData(data, action) {
  const next = clone(data);
  const type = action?.type;
  if (type === "add_contractors") {
    const count = Number(action.count) || 2;
    next.team.contractors += count;
    next.project.estimatedCost += count * 19000;
    next.project.onTimeProbability = clamp(next.project.onTimeProbability + count * 0.17);
    next.project.defectRisk = clamp(next.project.defectRisk + count * 0.03);
    next.team.backendCapacityGap = clamp(next.team.backendCapacityGap - count * 0.07);
    next.risk.delivery = clamp(next.risk.delivery - count * 0.08);
  }
  if (type === "reduce_scope") {
    const percentage = Number(action.percentage) || 15;
    next.project.scopeGrowthRate = Math.max(0, next.project.scopeGrowthRate - percentage / 100);
    next.project.remainingEffortHours = Math.round(next.project.remainingEffortHours * (1 - percentage / 130));
    next.project.estimatedCost = Math.max(0, next.project.estimatedCost - 18000);
    next.project.onTimeProbability = clamp(next.project.onTimeProbability + 0.38);
    next.project.defectRisk = clamp(next.project.defectRisk - 0.02);
    next.risk.delivery = clamp(next.risk.delivery - 0.19);
    next.customer.renewalProbability = clamp(next.customer.renewalProbability + 0.08);
  }
  if (type === "freeze_scope") {
    next.project.onTimeProbability = clamp(next.project.onTimeProbability + 0.28);
    next.project.defectRisk = clamp(next.project.defectRisk - 0.01);
    next.risk.delivery = clamp(next.risk.delivery - 0.13);
  }
  if (type === "split_release") {
    next.project.onTimeProbability = clamp(next.project.onTimeProbability + 0.43);
    next.project.defectRisk = clamp(next.project.defectRisk - 0.03);
    next.customer.renewalProbability = clamp(next.customer.renewalProbability + 0.16);
    next.risk.customer = clamp(next.risk.customer - 0.13);
  }
  if (type === "move_release_date" && action.date) {
    next.project.plannedReleaseDate = isoDate(action.date);
    next.project.predictedReleaseDate = isoDate(action.date);
  }
  return next;
}

function scenarioMetrics(data, action) {
  const simulated = applyScenarioData(data, action);
  const type = action?.type || "continue_unchanged";
  const dateShift = type === "split_release" ? -20 : type === "reduce_scope" ? -17 : type === "freeze_scope" ? -13 : type === "add_contractors" ? -10 : 0;
  const baselineDate = simulated.project.predictedReleaseDate || "2026-10-04";
  const date = type === "continue_unchanged" ? baselineDate : addDays(baselineDate, dateShift);
  const defaults = SCENARIOS.find((item) => item.actionType === type) || SCENARIOS[0];
  return {
    onTimeProbability: clamp(simulated.project.onTimeProbability),
    predictedReleaseDate: date,
    estimatedCost: Math.round(simulated.project.estimatedCost),
    defectRisk: clamp(simulated.project.defectRisk + (type === "add_contractors" ? 0.03 : 0)),
    renewalProbability: clamp(simulated.customer.renewalProbability),
    confidence: defaults.confidence,
    score: defaults.score,
    customerImpact: defaults.customerImpact,
  };
}

function daysBetween(first, second) {
  const a = new Date(`${isoDate(first)}T00:00:00Z`).getTime();
  const b = new Date(`${isoDate(second)}T00:00:00Z`).getTime();
  return Math.round((a - b) / 86400000);
}

export function evaluateAlignment(trajectory, objective = DEFAULT_OBJECTIVE) {
  const metrics = trajectory.metrics || {};
  const targetDate = objective.targetValue || DEFAULT_OBJECTIVE.targetValue;
  const daysLate = Math.max(0, daysBetween(metrics.predictedReleaseDate, targetDate));
  const dateAlignment = clamp(1 - daysLate / 45);
  const onTimeAlignment = clamp(metrics.onTimeProbability);
  const renewalAlignment = clamp(metrics.renewalProbability);
  const defectAlignment = clamp(1 - metrics.defectRisk);
  const weights = objective.weights || DEFAULT_OBJECTIVE.weights;
  const violations = [];
  const additionalCost = Math.max(0, Number(metrics.estimatedCost || 0) - INITIAL_WORLD.project.estimatedCost);
  (objective.constraints || []).forEach((constraint) => {
    const value = constraint.metric === "additionalCost" ? additionalCost : Number(metrics[constraint.metric]);
    const target = Number(constraint.value);
    const violated = constraint.operator === "less_than"
      ? value >= target
      : constraint.operator === "less_than_or_equal"
        ? value > target
        : constraint.operator === "greater_than"
          ? value <= target
          : constraint.operator === "greater_than_or_equal"
            ? value < target
            : value !== target;
    if (violated) violations.push(`${constraint.metric} constraint exceeded`);
  });
  const weighted = (
    onTimeAlignment * (weights.onTimeProbability || 0.35) +
    dateAlignment * (weights.targetDate || 0.35) +
    renewalAlignment * (weights.renewalProbability || 0.2) +
    defectAlignment * (weights.defectRisk || 0.1)
  );
  const penalty = violations.length * 0.12;
  const overall = clamp(weighted - penalty);
  return {
    overall,
    domains: {
      project: clamp((dateAlignment + onTimeAlignment) / 2),
      people: clamp(onTimeAlignment * 0.92),
      customer: renewalAlignment,
      technology: defectAlignment,
      finance: clamp(1 - additionalCost / 40000),
    },
    tradeoffs: additionalCost > 0 ? [`Additional cost: €${Math.round(additionalCost / 1000)}k`] : [],
    violations,
  };
}

export function transition(state, action, timeStep = 1) {
  const data = applyScenarioData(state.data || state.metrics || INITIAL_WORLD, action);
  return makeState(data, `${state.version}-sim-${timeStep}`, "simulated", state.timestamp, state.sourceEventIds || []);
}

export function rollout(state, action, horizon = 12, objective = DEFAULT_OBJECTIVE) {
  const nextState = transition(state, action, horizon);
  const scenarioId = action?.id || action?.scenarioId || action?.type || "baseline";
  const metrics = scenarioMetrics(state.data || INITIAL_WORLD, action);
  const alignment = evaluateAlignment({ metrics }, objective);
  return {
    id: `${scenarioId}-${state.version}`,
    scenarioId,
    label: action?.label || action?.type || "Continue unchanged",
    shortLabel: action?.shortLabel || action?.label || "Baseline",
    baseStateVersion: state.version,
    actionIds: action?.type ? [action.type] : [],
    states: [state, nextState],
    confidence: metrics.confidence,
    uncertainty: 1 - metrics.confidence,
    assumptions: ["Synthetic deterministic demonstration rule set.", `Horizon: ${horizon} weeks.`],
    metrics,
    alignmentScore: alignment.overall,
    domainAlignment: alignment.domains,
    constraintViolations: alignment.violations,
    recommendationScore: alignment.overall,
  };
}

export function compareScenarios(state, actions = SCENARIOS, objective = DEFAULT_OBJECTIVE) {
  return actions.map((scenario) => rollout(state, {
    ...scenario,
    type: scenario.type || scenario.actionType,
  }, 12, objective));
}

export function reconstructAt(events = [], target) {
  if (!target || target === "now") return encodeState(events);
  const selectedIndex = events.findIndex((event) => event.id === target);
  if (selectedIndex >= 0) return encodeState(events.slice(0, selectedIndex + 1));
  const targetDate = new Date(target).getTime();
  if (!Number.isNaN(targetDate)) return encodeState(events.filter((event) => new Date(event.timestamp).getTime() <= targetDate));
  return encodeState(events);
}

export function createWorldEvent({ command, sourceMessageId, previousStateVersion = "v0", id, timestamp = new Date().toISOString() }) {
  return {
    id: id || `event-${Date.now()}`,
    timestamp: command.event?.timestamp || timestamp,
    recordedAt: timestamp,
    sourceMessageId: sourceMessageId || "unknown-message",
    type: command.event?.type || "observation",
    domain: command.event?.domain || "operations",
    entityIds: command.event?.entityIds || [],
    payload: clone(command.event?.payload || {}),
    stateKind: "observed",
    confidence: command.confidence,
    assumptions: command.assumptions || [],
    previousStateVersion,
    resultingStateVersion: `v${Number(String(previousStateVersion).replace("v", "")) + 1}`,
  };
}
