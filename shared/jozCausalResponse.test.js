import test from "node:test";
import assert from "node:assert/strict";
import { buildJozCausalDecisionSupportReply } from "./jozCausalResponse.js";

test("composes an evidence-bounded intervention response", () => {
  const result = buildJozCausalDecisionSupportReply({
    input: "What would happen if customer wait time decreased by 20%?",
    causalAnalysis: {
      queryType: "intervention",
      status: "not_executed",
    },
  });

  assert.equal(result.answerSource, "causal_decision_support");
  assert.match(result.reply, /an intervention question/i);
  assert.match(result.reply, /versioned dataset/i);
  assert.match(result.reply, /not a causal estimate/i);
});

test("does not fabricate an effect when the causal service is unavailable", () => {
  const result = buildJozCausalDecisionSupportReply({
    input: "What would happen if customer wait time decreased by 20%?",
    causalAnalysis: {
      queryType: "intervention",
      status: "unavailable",
    },
  });

  assert.match(result.reply, /temporarily unavailable/i);
  assert.match(result.reply, /will not invent an effect/i);
});

test("surfaces an estimated effect and refutation status", () => {
  const result = buildJozCausalDecisionSupportReply({
    input: "What would happen if customer wait time decreased by 20%?",
    causalAnalysis: { queryType: "intervention", status: "not_executed" },
    causalTool: {
      result: {
        status: "estimated",
        treatment_value: 8,
        control_value: 10,
        average_treatment_effect: 0.052,
        refutation: { status: "not_refuted" },
      },
    },
  });

  assert.match(result.reply, /\+5\.2 percentage points/);
  assert.match(result.reply, /not_refuted/i);
  assert.match(result.reply, /synthetic customer-wait-time dataset/i);
});
