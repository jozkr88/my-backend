const unsupportedReply = "I can update the seeded Atlas world with a supported observation, or simulate contractors, scope reduction, a split release, or a scope freeze.";

const EVENT_DOMAINS = new Set(["project", "people", "customer", "technology", "finance", "operations"]);
const INTENTS = new Set(["observe", "record_event", "correct_state", "simulate", "compare", "explain", "navigate_timeline", "set_objective", "add_constraint", "reset"]);

export function validateWorldModelCommand(command) {
  if (!command || typeof command !== "object") return null;
  const intent = String(command.intent || command.mode || "").trim();
  if (!INTENTS.has(intent)) return null;

  const event = command.event && typeof command.event === "object" ? command.event : undefined;
  if (event && !EVENT_DOMAINS.has(String(event.domain || ""))) return null;

  const scenario = command.scenario && typeof command.scenario === "object" ? command.scenario : undefined;
  const action = scenario?.action;
  if (action && !["add_contractors", "reduce_scope", "freeze_scope", "split_release", "move_release_date", "reassign_capacity", "continue_unchanged"].includes(String(action.type))) return null;
  const objective = command.objective && typeof command.objective === "object" ? {
    id: command.objective.id ? String(command.objective.id) : undefined,
    label: command.objective.label ? String(command.objective.label).slice(0, 240) : undefined,
    primaryMetric: command.objective.primaryMetric ? String(command.objective.primaryMetric) : undefined,
    optimization: command.objective.optimization ? String(command.objective.optimization) : undefined,
    targetValue: command.objective.targetValue,
    constraints: Array.isArray(command.objective.constraints) ? command.objective.constraints.slice(0, 8) : [],
    weights: command.objective.weights && typeof command.objective.weights === "object" ? command.objective.weights : undefined,
  } : undefined;

  const confidence = Math.min(1, Math.max(0, Number.isFinite(Number(command.confidence)) ? Number(command.confidence) : 0.72));
  const normalized = {
    intent,
    mode: intent === "record_event" || intent === "observe" || intent === "correct_state" ? "explain" : intent === "navigate_timeline" ? "focus" : intent,
    userIntent: String(command.userIntent || command.summary || "").slice(0, 240),
    summary: String(command.summary || command.explanation?.summary || unsupportedReply).slice(0, 800),
    focusEntities: Array.isArray(command.focusEntities) ? command.focusEntities.slice(0, 10) : [],
    confidence,
    assumptions: Array.isArray(command.assumptions) ? command.assumptions.map(String).slice(0, 6) : [],
    event: event ? {
      type: String(event.type || "observation"),
      domain: String(event.domain),
      entityIds: Array.isArray(event.entityIds) ? event.entityIds.map(String).slice(0, 8) : [],
      timestamp: event.timestamp ? String(event.timestamp) : undefined,
      payload: event.payload && typeof event.payload === "object" ? event.payload : {},
    } : undefined,
    scenario: scenario ? {
      action: { ...action, type: String(action.type), domain: action.domain ? String(action.domain) : undefined },
      horizonWeeks: Number(scenario.horizonWeeks) || 12,
      objective: String(scenario.objective || "increase on-time delivery probability"),
      constraints: Array.isArray(scenario.constraints) ? scenario.constraints.slice(0, 5) : [],
    } : undefined,
    comparison: command.comparison?.scenarios ? { scenarios: command.comparison.scenarios } : undefined,
    timeline: command.timeline ? {
      targetEventId: command.timeline.targetEventId ? String(command.timeline.targetEventId) : undefined,
      targetTimestamp: command.timeline.targetTimestamp ? String(command.timeline.targetTimestamp) : undefined,
      returnToNow: Boolean(command.timeline.returnToNow),
    } : undefined,
    explanation: {
      summary: String(command.explanation?.summary || command.summary || unsupportedReply).slice(0, 800),
      factors: Array.isArray(command.explanation?.factors) ? command.explanation.factors.slice(0, 8) : [],
    },
    camera: command.camera ? { view: String(command.camera.view || "overview"), targetEntityId: command.camera.targetEntityId } : { view: "overview" },
    scenarioRequest: scenario ? { actionType: scenario.action.type, parameters: scenario.action, objective: scenario.objective } : undefined,
    objective,
  };
  return normalized;
}

function makeCommand({ intent, message, summary, focus = [], event, scenario, timeline, objective, view = "overview", target, confidence = 0.8, assumptions = [] }) {
  return validateWorldModelCommand({
    intent,
    userIntent: message,
    summary,
    focusEntities: focus,
    event,
    scenario,
    timeline,
    objective,
    confidence,
    assumptions,
    explanation: { summary },
    camera: { view, targetEntityId: target },
  });
}

export function interpretDemoCommand(input) {
  const message = String(input || "").trim();
  const text = message.toLowerCase();
  if (!message) return null;

  if (/^(reset|start over|clear simulation)/.test(text)) {
    return makeCommand({ intent: "reset", message, summary: "Returned to the observed operational state.", timeline: { returnToNow: true } });
  }
  if (/return to now|return to current|back to now/.test(text)) {
    return makeCommand({ intent: "navigate_timeline", message, summary: "Returned to the current observed state.", timeline: { returnToNow: true }, view: "overview" });
  }
  if (/go back|before the scope increase|history|historical/.test(text)) {
    return makeCommand({ intent: "navigate_timeline", message, summary: "Viewing the world before the selected historical change.", timeline: { targetEventId: "before-scope-growth" }, view: "timeline" });
  }
  if (/compare|best three|safest|options|interventions/.test(text)) {
    return makeCommand({ intent: "compare", message, summary: "Comparing the supported intervention futures from the current observed state.", focus: ["project", "team", "customer"], view: "scenario_compare" });
  }
  if (/set (the )?goal|goal (is|to)|release by september|launch by september/.test(text)) {
    return makeCommand({ intent: "set_objective", message, summary: "Set the desired future: release by 15 September while keeping defect risk at or below 15%.", objective: { id: "atlas-release-objective", label: "Release by 15 September without increasing defect risk above 15%.", primaryMetric: "predictedReleaseDate", optimization: "target", targetValue: "2026-09-15", constraints: [{ metric: "defectRisk", operator: "less_than_or_equal", value: 0.15 }] }, view: "scenario_compare", confidence: 0.91 });
  }
  if (/additional spend|additional cost|spend below|cannot exceed.*(40|€40)/.test(text)) {
    return makeCommand({ intent: "add_constraint", message, summary: "Added a constraint: additional spend must stay at or below €40k.", objective: { constraints: [{ metric: "additionalCost", operator: "less_than_or_equal", value: 40000 }] }, view: "scenario_compare", confidence: 0.9 });
  }
  if (/what if|what happens if|assume we|if we/.test(text) && /contractor|engineer|people|capacity/.test(text)) {
    return makeCommand({ intent: "simulate", message, summary: "A hypothetical capacity intervention will be simulated without changing current reality.", focus: ["team", "project", "customer"], scenario: { action: { type: "add_contractors", count: 2, domain: "people" }, objective: "increase on-time delivery probability" }, view: "scenario_compare", confidence: 0.68, assumptions: ["Two contractors are available for the 12-week horizon.", "Current scope and release boundary remain unchanged."] });
  }
  if (/what if|what happens if|assume we|if we/.test(text) && /reduce scope|scope by 15|cut scope|smaller scope/.test(text)) {
    return makeCommand({ intent: "simulate", message, summary: "A hypothetical 15% scope reduction will be simulated without changing current reality.", focus: ["project", "customer"], scenario: { action: { type: "reduce_scope", percentage: 15, domain: "project" }, objective: "increase on-time delivery probability" }, view: "scenario_compare", confidence: 0.77, assumptions: ["The removed scope is noncritical.", "Customer renewal sensitivity follows the seeded demonstration rule."] });
  }
  if (/split release|release in two|phased release|phase the release/.test(text)) {
    return makeCommand({ intent: "simulate", message, summary: "A hypothetical split release will be simulated without changing current reality.", focus: ["project", "customer"], scenario: { action: { type: "split_release", domain: "project" }, objective: "protect customer value" }, view: "scenario_compare", confidence: 0.74 });
  }
  if (/freeze|noncritical/.test(text)) {
    return makeCommand({ intent: "simulate", message, summary: "Freezing noncritical scope will be simulated without changing current reality.", focus: ["project", "customer"], scenario: { action: { type: "freeze_scope", domain: "project" }, objective: "reduce delivery variance" }, view: "scenario_compare", confidence: 0.75 });
  }

  if (/move the release|move release|release to october|release in october/.test(text)) {
    return makeCommand({ intent: "correct_state", message, summary: "The release boundary will be updated as an observed planning correction.", focus: ["project"], event: { type: "release_date_moved", domain: "project", entityIds: ["project", "release"], payload: { date: "2026-10-01" } }, view: "focus", target: "project", confidence: 0.82 });
  }
  if (/hired|hire|joined|added.*engineer|added.*developer/.test(text) && /engineer|developer|people|backend/.test(text)) {
    const count = Number(text.match(/(\d+)/)?.[1]) || 2;
    return makeCommand({ intent: "record_event", message, summary: `Observed event: ${count} engineer${count === 1 ? "" : "s"} added to team capacity.`, focus: ["team", "project", "technology"], event: { type: "people_hired", domain: "people", entityIds: ["team", "backend"], payload: { count, role: /backend/.test(text) ? "backend" : "engineering" } }, confidence: 0.86, assumptions: ["The hires are available to the Atlas team effective now."] });
  }
  if (/blocked|block(ed)? tasks/.test(text) && /backend|task/.test(text)) {
    const count = Number(text.match(/(\d+)/)?.[1]) || 3;
    return makeCommand({ intent: "record_event", message, summary: `Observed event: ${count} backend task${count === 1 ? " is" : "s are"} blocked.`, focus: ["technology", "project"], event: { type: "backend_tasks_blocked", domain: "technology", entityIds: ["backend", "critical-path"], payload: { count } }, confidence: 0.84 });
  }
  if (/customer added|added.*scope|more scope|scope grew|scope increase/.test(text)) {
    const percentage = Number(text.match(/(\d+)\s*%/)?.[1]) || 20;
    return makeCommand({ intent: "record_event", message, summary: `Observed event: customer scope increased by ${percentage}%.`, focus: ["customer", "project", "team", "technology"], event: { type: "scope_growth", domain: "customer", entityIds: ["customer", "scope", "project"], payload: { percentage } }, confidence: 0.88, assumptions: ["The added scope is now part of the active delivery commitment."] });
  }
  if (/senior engineer left|engineer left|developer left|lost an engineer|departure/.test(text)) {
    return makeCommand({ intent: "record_event", message, summary: "Observed event: one senior engineering capacity unit left the team.", focus: ["team", "technology", "project"], event: { type: "people_departed", domain: "people", entityIds: ["team", "backend"], payload: { count: 1, role: "senior engineer" } }, confidence: 0.87 });
  }
  if (/customer|renewal|sentiment/.test(text)) {
    return makeCommand({ intent: "explain", message, summary: "Customer renewal is drifting because the release misses its planned boundary and delivery risk remains elevated.", focus: ["customer", "project"], view: "focus", target: "customer" });
  }
  if (/why|delay|late|behind|critical path|atlas/.test(text)) {
    return validateWorldModelCommand({
      ...makeCommand({ intent: "explain", message, summary: "Atlas is delayed by scope growth, a backend capacity gap, critical-path congestion, and review latency before release.", focus: ["scope", "backend", "critical-path", "qa", "release", "customer"], view: "causal_path", target: "critical-path" }),
      explanation: { summary: "Atlas is delayed by a causal chain: scope growth widens the backend capacity gap, which congests the critical path and increases review latency before release.", factors: [
        { entityId: "scope", label: "Scope growth", contribution: 0.28, evidence: "+14% scope growth rate" },
        { entityId: "backend", label: "Backend capacity gap", contribution: 0.22, evidence: "21% capacity gap" },
        { entityId: "critical-path", label: "Critical-path congestion", contribution: 0.19, evidence: "18% blocked work" },
        { entityId: "qa", label: "Review latency", contribution: 0.12, evidence: "+31% review latency" },
      ] },
    });
  }

  return makeCommand({ intent: "explain", message, summary: unsupportedReply });
}

export const DEMO_UNSUPPORTED_REPLY = unsupportedReply;
