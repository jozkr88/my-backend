import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizeJozCausalTool,
  buildJozCausalPrincipal,
  buildJozCausalRunRecord,
  completeJozCausalRunRecord,
} from "./jozCausalAuthorization.js";

const graph = {
  nodes: [
    { id: "causal_dataset:joz-public-knowledge", type: "causal_dataset" },
    { id: "causal_dataset:causal-ai-architect", type: "causal_dataset" },
  ],
};

const args = {
  model_id: "causal-ai-architect",
  model_version: "latest_published",
  variable_id: "decision_quality",
  direction: "both",
  max_depth: 2,
};

test("authorizes only published read-only causal datasets", () => {
  const result = authorizeJozCausalTool({
    toolName: "get_causal_neighbourhood",
    args,
    mode: "shadow",
    graph,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.code, "AUTHORIZED");
  assert.equal(result.args.model_id, "causal-ai-architect");
});

test("rejects unpublished datasets and execution intents", () => {
  const unpublished = authorizeJozCausalTool({
    toolName: "get_causal_neighbourhood",
    args: { ...args, model_id: "private-dataset" },
    mode: "augment",
    graph,
  });
  assert.equal(unpublished.code, "CAUSAL_DATASET_NOT_AUTHORIZED");

  const execution = authorizeJozCausalTool({
    toolName: "get_causal_neighbourhood",
    args,
    mode: "decision_support",
    intentKind: "execute",
    graph,
  });
  assert.equal(execution.code, "CAUSAL_INTENT_NOT_READ_ONLY");
});

test("run records are bounded and transition to a terminal status", () => {
  const principal = buildJozCausalPrincipal({ auth: { userId: "u-1", companyKey: "public" } });
  const started = buildJozCausalRunRecord({
    runId: "run-1",
    requestId: "request-1",
    toolName: "inspect_causal_claim",
    mode: "shadow",
    authorization: { principal },
  });
  const completed = completeJozCausalRunRecord(started, {
    status: "completed_with_warning",
    result: { status: "ok", warnings: ["association_only"] },
  });
  assert.equal(started.status, "authorized");
  assert.equal(completed.status, "completed_with_warning");
  assert.equal(completed.result.status, "ok");
  assert.ok(completed.completedAt);
});

