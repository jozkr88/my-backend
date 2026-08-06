import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyJozCausalQuery,
  getJozCausalServiceMode,
  requestJozCausalAnalysis,
  requestJozCausalCounterfactual,
  requestJozCausalRefutation,
  requestJozCausalEffectEstimate,
} from "./jozCausalService.js";

test("causal service is disabled by default", () => {
  assert.equal(getJozCausalServiceMode({}), "disabled");
});

test("effect estimation uses the causal service boundary", async () => {
  const result = await requestJozCausalEffectEstimate({
    env: { JOZ_CAUSAL_MODE: "decision_support", JOZ_CAUSAL_SERVICE_URL: "http://causal.test" },
    request: { treatment: "price", outcome: "demand" },
    fetchImpl: async (url, options) => {
      assert.equal(url, "http://causal.test/v1/causal/effect");
      assert.equal(options.method, "POST");
      return { ok: true, async json() { return { status: "estimated", operation: "effect_estimation", average_treatment_effect: 2.5 }; } };
    },
  });
  assert.equal(result.status, "estimated");
  assert.equal(result.average_treatment_effect, 2.5);
});

test("counterfactual execution uses the causal service boundary", async () => {
  const result = await requestJozCausalCounterfactual({
    env: { JOZ_CAUSAL_MODE: "decision_support", JOZ_CAUSAL_SERVICE_URL: "http://causal.test" },
    request: { intervention_variable: "price", target: "demand" },
    fetchImpl: async (url, options) => {
      assert.equal(url, "http://causal.test/v1/causal/counterfactual");
      assert.equal(options.method, "POST");
      return { ok: true, async json() { return { status: "estimated", operation: "counterfactual", delta: 10 }; } };
    },
  });
  assert.equal(result.status, "estimated");
  assert.equal(result.delta, 10);
});

test("refutation uses the causal service boundary", async () => {
  const result = await requestJozCausalRefutation({
    env: { JOZ_CAUSAL_MODE: "shadow", JOZ_CAUSAL_SERVICE_URL: "http://causal.test" },
    request: { significance_level: 0.05 },
    fetchImpl: async (url, options) => {
      assert.equal(url, "http://causal.test/v1/causal/refute");
      assert.equal(options.method, "POST");
      return { ok: true, async json() { return { status: "not_refuted", operation: "refutation", rejection_result: "NOT_REJECTED" }; } };
    },
  });
  assert.equal(result.status, "not_refuted");
  assert.equal(result.rejection_result, "NOT_REJECTED");
});

test("classifies counterfactual and intervention questions", () => {
  assert.equal(classifyJozCausalQuery("What would have happened if we changed price?"), "counterfactual");
  assert.equal(classifyJozCausalQuery("What if we increase inventory?"), "intervention");
});

test("returns a safe service response in shadow mode", async () => {
  const result = await requestJozCausalAnalysis({
    query: "What causes demand?",
    env: { JOZ_CAUSAL_MODE: "shadow", JOZ_CAUSAL_SERVICE_URL: "http://causal.test" },
    fetchImpl: async (url, options) => {
      assert.equal(url, "http://causal.test/v1/analyze");
      assert.equal(options.method, "POST");
      return {
        ok: true,
        async json() {
          return {
            query_type: "association",
            claim_status: "association_only",
            status: "not_executed",
          };
        },
      };
    },
  });

  assert.equal(result.mode, "shadow");
  assert.equal(result.queryType, "association");
  assert.equal(result.claimStatus, "association_only");
});
