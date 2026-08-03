import { interpretDemoCommand } from "./commandInterpreter";
import {
  applyObservedEvent,
  compareScenarios,
  createInitialWorldState,
  createWorldEvent,
  encodeState,
  evaluateAlignment,
  reconstructAt,
} from "./worldRuntime";

test("applies an observed scope event to current reality", () => {
  const command = interpretDemoCommand("The customer added 20% more scope.");
  const event = createWorldEvent({ command, sourceMessageId: "message-1", id: "event-scope", timestamp: "2026-08-01T10:33:00.000Z" });
  const next = applyObservedEvent(createInitialWorldState(), event);

  expect(next.kind).toBe("observed");
  expect(next.data.project.scopeGrowthRate).toBeCloseTo(0.34);
  expect(next.data.project.onTimeProbability).toBeLessThan(0.24);
  expect(next.sourceEventIds).toEqual(["event-scope"]);
});

test("reconstructs a world from immutable events", () => {
  const scopeCommand = interpretDemoCommand("The customer added 20% more scope.");
  const hireCommand = interpretDemoCommand("We hired two backend engineers.");
  const events = [
    createWorldEvent({ command: scopeCommand, sourceMessageId: "scope", id: "scope-event", timestamp: "2026-08-01T10:00:00.000Z" }),
    createWorldEvent({ command: hireCommand, sourceMessageId: "hire", id: "hire-event", timestamp: "2026-08-01T10:05:00.000Z" }),
  ];
  const beforeHire = reconstructAt(events, "scope-event");
  const now = encodeState(events);

  expect(beforeHire.sourceEventIds).toEqual(["scope-event"]);
  expect(now.sourceEventIds).toEqual(["scope-event", "hire-event"]);
  expect(now.data.team.engineers).toBe(14);
});

test("simulated futures do not alter observed state", () => {
  const state = createInitialWorldState();
  const baseline = state.data.team.engineers;
  const trajectories = compareScenarios(state);
  const contractors = trajectories.find((trajectory) => trajectory.scenarioId === "contractors");

  expect(contractors.states[1].kind).toBe("simulated");
  expect(contractors.metrics.onTimeProbability).toBeGreaterThan(state.data.project.onTimeProbability);
  expect(state.data.team.engineers).toBe(baseline);
});

test("evaluates a future against the desired date and constraints", () => {
  const alignment = evaluateAlignment({ metrics: { predictedReleaseDate: "2026-09-14", onTimeProbability: 0.83, renewalProbability: 0.84, defectRisk: 0.09, estimatedCost: 405000 } });
  expect(alignment.overall).toBeGreaterThan(0.7);
  expect(alignment.violations).toEqual([]);
});
