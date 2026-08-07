import test from "node:test";
import assert from "node:assert/strict";
import {
  buildJozSelfCorrectionContext,
  classifyJozRepairCandidate,
} from "./jozSelfCorrection.js";

test("allows only bounded style repairs into the automatic lane", () => {
  const policy = classifyJozRepairCandidate({
    repairType: "prompt",
    targetKey: "business_need",
    question: "How can a manufacturer reduce downtime with AI? Please keep the answer practical.",
    suggestion: "Provide a direct, practical answer with specific examples.",
    verdict: "fail",
    safety: 5,
    correctness: 3,
  });
  assert.equal(policy.autoApply, true);
  assert.equal(policy.lane, "automatic_low_risk");
  assert.match(policy.rule.instruction, /concrete examples/i);
});

test("keeps knowledge and causal repairs in human review", () => {
  const knowledge = classifyJozRepairCandidate({
    repairType: "knowledge",
    targetKey: "skills",
    suggestion: "Add a practical knowledge graph example.",
  });
  const causal = classifyJozRepairCandidate({
    repairType: "prompt",
    targetKey: "business_need",
    question: "What is the causal effect?",
    suggestion: "Give a concise answer.",
    safety: 5,
    correctness: 5,
  });
  assert.equal(knowledge.autoApply, false);
  assert.equal(causal.autoApply, false);
  assert.equal(causal.lane, "human_review");
});

test("builds bounded runtime context from active rules", () => {
  const context = buildJozSelfCorrectionContext([
    { id: 1, scope: "business_need", trigger_terms: ["practical"], instruction: "Use concrete steps." },
    { id: 3, scope: "skills", instruction: "Do not use this here." },
    { id: 2, status: "rejected", scope: "skills", instruction: "Do not use this." },
  ], "business_need");
  assert.equal(context.mode, "bounded_runtime_guidance");
  assert.equal(context.rules.length, 1);
  assert.match(context.instruction, /cannot change facts/i);
});
