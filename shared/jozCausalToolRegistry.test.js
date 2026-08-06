import test from "node:test";
import assert from "node:assert/strict";
import {
  executeJozCausalTool,
  getJozCausalToolDefinitions,
  validateJozCausalToolArguments,
} from "./jozCausalToolRegistry.js";

const model = {
  model_id: "joz-causal-ai-chief-architect-v1",
  model_version: "joz-causal-architecture-v2",
};

test("causal tool registry exposes strict read-only Slice 1 tools", () => {
  assert.deepEqual(
    getJozCausalToolDefinitions().map((tool) => tool.name),
    ["get_causal_neighbourhood", "explain_causal_path", "inspect_causal_claim", "estimate_causal_effect", "run_counterfactual", "refute_causal_structure"]
  );
  assert.throws(
    () => validateJozCausalToolArguments("get_causal_neighbourhood", { ...model, variable_id: "Causal Discovery", direction: "both", max_depth: 2, extra: true }),
    /Unexpected tool argument/
  );
});

test("estimate_causal_effect validates numeric treatment values and stays data-gated", () => {
  const args = {
    model_id: "joz-causal-ai-chief-architect-v1",
    model_version: "joz-causal-architecture-v2",
    treatment_variable_id: "causal discovery",
    outcome_variable_id: "decision quality",
    treatment_value: 1,
    control_value: 0,
    samples: 100,
  };
  assert.equal(validateJozCausalToolArguments("estimate_causal_effect", args).samples, 100);
  const result = executeJozCausalTool({ toolName: "estimate_causal_effect", args });
  assert.equal(result.status, "data_required");
});

test("run_counterfactual validates the intervention contract and stays data-gated", () => {
  const args = {
    model_id: "joz-causal-ai-chief-architect-v1",
    model_version: "joz-causal-architecture-v2",
    intervention_variable_id: "causal discovery",
    intervention_value: 1,
    target_variable_id: "decision quality",
  };
  assert.equal(validateJozCausalToolArguments("run_counterfactual", args).intervention_value, 1);
  const result = executeJozCausalTool({ toolName: "run_counterfactual", args });
  assert.equal(result.status, "data_required");
});

test("refute_causal_structure validates significance and stays data-gated", () => {
  const args = {
    model_id: "joz-causal-ai-chief-architect-v1",
    model_version: "joz-causal-architecture-v2",
    significance_level: 0.05,
  };
  assert.equal(validateJozCausalToolArguments("refute_causal_structure", args).significance_level, 0.05);
  const result = executeJozCausalTool({ toolName: "refute_causal_structure", args });
  assert.equal(result.status, "data_required");
  assert.throws(() => validateJozCausalToolArguments("refute_causal_structure", { ...args, significance_level: 0.8 }), /significance_level/);
});

test("get_causal_neighbourhood returns version-scoped causal graph data", () => {
  const result = executeJozCausalTool({
    toolName: "get_causal_neighbourhood",
    args: { ...model, variable_id: "Causal Discovery", direction: "causes", max_depth: 2 },
  });
  assert.equal(result.status, "ok");
  assert.equal(result.model_version, "joz-causal-architecture-v2");
  assert.ok(result.relationships.some((relationship) => relationship.target_label === "Candidate Causal Structure"));
  assert.ok(result.warnings.length === 0 || result.warnings.every((warning) => typeof warning === "string"));
});

test("explain_causal_path distinguishes a direct path and its evidence status", () => {
  const result = executeJozCausalTool({
    toolName: "explain_causal_path",
    args: {
      model_id: "joz-ai-architecture-causal-v1",
      model_version: "joz-causal-architecture-v1",
      source_variable_id: "Semantic Knowledge Graph",
      target_variable_id: "Causal Inference Engine",
      max_paths: 5,
      max_depth: 6,
    },
  });
  assert.equal(result.status, "ok");
  assert.equal(result.paths[0].type, "direct");
  assert.equal(result.paths[0].relationships[0].status, "FRAMEWORK_SUPPORTED");
});

test("inspect_causal_claim returns assumptions, evidence, and model provenance", () => {
  const result = executeJozCausalTool({
    toolName: "inspect_causal_claim",
    args: { relationship_id: "semantic-graph-causal-engine-separation" },
  });
  assert.equal(result.status, "ok");
  assert.equal(result.relationship.status, "FRAMEWORK_SUPPORTED");
  assert.ok(result.evidence.length >= 1);
  assert.ok(result.assumptions.length >= 1);
  assert.ok(result.model_versions.length >= 1);
});
