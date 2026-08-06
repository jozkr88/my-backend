import test from "node:test";
import assert from "node:assert/strict";
import { evaluateJozCausalResponse } from "./jozCausalResponseEvaluation.js";

test("causal response evaluation requires active causal context and guarded answer language", () => {
  const result = evaluateJozCausalResponse({
    caseDefinition: {
      id: "identifiability",
      question: "When is a causal effect identifiable?",
      expectedCausal: true,
      requiredAny: [["identif"]],
      forbiddenPhrases: ["always identifiable"],
    },
    causalKnowledge: {
      activeInContext: true,
      documentCount: 3,
      workflow: ["define", "identify", "state uncertainty"],
      answerGuardrails: ["do not overclaim", "state assumptions"],
    },
    reply: "A causal effect is identifiable only under stated assumptions; otherwise the evidence may remain associative.",
    requireReply: true,
  });
  assert.equal(result.pass, true);
});

test("ordinary response evaluation rejects causal context leakage", () => {
  const result = evaluateJozCausalResponse({
    caseDefinition: {
      id: "ordinary",
      question: "What business value can Joz create?",
      expectedCausal: false,
    },
    causalKnowledge: { activeInContext: true, documentCount: 1 },
  });
  assert.equal(result.pass, false);
  assert.match(result.failures[0], /leaked/i);
});

test("live evaluation catches unsupported causal certainty", () => {
  const result = evaluateJozCausalResponse({
    caseDefinition: {
      id: "guardrail",
      question: "What is a counterfactual?",
      expectedCausal: true,
      requiredAny: [["counterfactual"]],
      forbiddenPhrases: ["guaranteed effect"],
    },
    causalKnowledge: {
      activeInContext: true,
      documentCount: 1,
      workflow: ["define", "intervene", "uncertainty"],
      answerGuardrails: ["state assumptions", "do not overclaim"],
    },
    reply: "A counterfactual asks what would have happened under another condition; it does not guarantee an effect.",
    requireReply: true,
  });
  assert.equal(result.pass, true);
});
