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
