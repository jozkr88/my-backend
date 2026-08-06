import test from "node:test";
import assert from "node:assert/strict";
import { resolveJozCausalDataset, validateJozCausalDataset } from "./jozCausalDatasetRegistry.js";

function dataset(overrides = {}) {
  return {
    metadata: { dataset_id: "dataset-a", model_version: "model-v1", tenant_id: "public" },
    nodes: [{ id: "treatment" }, { id: "outcome" }],
    edges: [{ source: "treatment", target: "outcome", type: "CAUSES" }],
    data: Array.from({ length: 20 }, (_, index) => ({ treatment: index % 2, outcome: index + 1 })),
    ...overrides,
  };
}

test("validates and fingerprints a versioned causal dataset", () => {
  const result = validateJozCausalDataset(dataset());
  assert.equal(result.ok, true);
  assert.equal(result.dataset.dataset_id, "dataset-a");
  assert.equal(result.dataset.model_version, "model-v1");
  assert.match(result.dataset.checksum, /^[a-f0-9]{64}$/);
});

test("rejects cyclic, incomplete, or non-numeric causal data", () => {
  const result = validateJozCausalDataset(dataset({
    edges: [
      { source: "treatment", target: "outcome" },
      { source: "outcome", target: "treatment" },
    ],
    data: Array.from({ length: 20 }, () => ({ treatment: "bad", outcome: 1 })),
  }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("graph_must_be_acyclic"));
  assert.ok(result.errors.includes("row_0_contains_missing_or_non_numeric_values"));
});

test("resolves only the requested dataset and model version", () => {
  const result = resolveJozCausalDataset({
    context: { causalData: dataset() },
    requestedModelId: "dataset-a",
    requestedModelVersion: "model-v1",
    principal: { tenantId: "public" },
  });
  assert.equal(result.ok, true);
  assert.equal(resolveJozCausalDataset({ context: { causalData: dataset() }, requestedModelId: "other" }).code, "CAUSAL_DATASET_ID_MISMATCH");
});

