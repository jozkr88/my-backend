import test from "node:test";
import assert from "node:assert/strict";
import {
  buildJozValueCausalReply,
  isJozValueCausalQuestion,
  matchJozValueCausalPathways,
} from "./jozValueCausalModel.js";

test("recognizes Joz skill-to-value questions", () => {
  assert.equal(isJozValueCausalQuestion("How does Joz's agentic AI architecture create business value?"), true);
  assert.equal(isJozValueCausalQuestion("What is the causal effect of price on demand?"), false);
  assert.equal(isJozValueCausalQuestion("What are you?"), false);
});

test("selects a specific value pathway", () => {
  const pathways = matchJozValueCausalPathways("What business value does Joz create through spatial intelligence?");
  assert.deepEqual(pathways.map((pathway) => pathway.id), ["human_centered_spatial_ai"]);
});

test("composes bounded Joz value reasoning", () => {
  const result = buildJozValueCausalReply({
    input: "How does Joz's agentic AI architecture create business value?",
  });
  assert.equal(result.answerSource, "joz_value_causal_model");
  assert.match(result.reply, /skill → method → evidence → business outcome/);
  assert.doesNotMatch(result.reply, /by turn fragmented/i);
  assert.match(result.reply, /by turning fragmented/i);
  assert.match(result.reply, /supported by Joz's skills and project evidence/i);
  assert.match(result.reply, /unsupported causal or ROI claim/i);
  assert.equal(result.causalValue.modelVersion, "joz-value-pathways-v1");
});
