import { interpretDemoCommand, validateWorldModelCommand } from "./commandInterpreter";
import { getScenario } from "./seedWorld";

test("maps the seeded delay question to the causal path", () => {
  const command = interpretDemoCommand("Why is Project Atlas delayed?");
  expect(command.mode).toBe("explain");
  expect(command.camera.view).toBe("causal_path");
  expect(command.focusEntities).toEqual(["scope", "backend", "critical-path", "qa", "release", "customer"]);
  expect(command.explanation.factors[0].entityId).toBe("scope");
});

test("maps scope reduction to the deterministic scenario", () => {
  const command = interpretDemoCommand("What if we reduce scope by 15%?");
  expect(command.mode).toBe("simulate");
  expect(command.scenarioRequest).toEqual(expect.objectContaining({ actionType: "reduce_scope" }));
  expect(command.scenarioRequest.parameters.percentage).toBe(15);
  expect(getScenario("scope").onTimeProbability).toBe(0.76);
});

test("rejects malformed command modes at the scene boundary", () => {
  expect(validateWorldModelCommand({ mode: "execute" })).toBeNull();
  expect(validateWorldModelCommand({ mode: "simulate", explanation: {} }).camera.view).toBe("overview");
});

test("maps desired future language to an objective command", () => {
  const command = interpretDemoCommand("Set the goal: launch by September 15");
  expect(command.intent).toBe("set_objective");
  expect(command.objective.targetValue).toBe("2026-09-15");
});

test("maps budget language to an explicit constraint", () => {
  const command = interpretDemoCommand("Keep additional spend below €40k");
  expect(command.intent).toBe("add_constraint");
  expect(command.objective.constraints[0]).toEqual(expect.objectContaining({ metric: "additionalCost", value: 40000 }));
});
