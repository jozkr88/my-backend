import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_DISCLOSURE_TEXT,
  AI_MACHINE_READABLE_DISCLOSURE,
  JOZ_AI_SYSTEM_CARD,
  applyBusinessValueGovernance,
  assessAIActUse,
} from "./shared/aiActGovernance.js";

test("AI system card contains explicit interaction disclosure and non-use boundaries", () => {
  assert.match(AI_DISCLOSURE_TEXT, /interacting with Joz LLM/i);
  assert.ok(JOZ_AI_SYSTEM_CARD.notIntendedFor.some((item) => /employment/i.test(item)));
  assert.ok(JOZ_AI_SYSTEM_CARD.safeguards.some((item) => /human review/i.test(item)));
  assert.equal(AI_MACHINE_READABLE_DISCLOSURE.aiGenerated, true);
  assert.equal(AI_MACHINE_READABLE_DISCLOSURE.humanReviewRequiredForConsequentialUse, true);
});

test("organizational diagnostic remains available with transparency controls", () => {
  const assessment = assessAIActUse({ input: "Our data is stale and our AI pilot is too generic." });
  assert.equal(assessment.status, "clear_with_transparency");
  assert.equal(assessment.allowedForDiagnostic, true);
});

test("high-impact employment use is stopped for human and compliance review", () => {
  const assessment = assessAIActUse({ input: "Use this to rank candidates and make the hiring decision." });
  assert.equal(assessment.status, "restricted");
  assert.equal(assessment.allowedForDiagnostic, false);
  const state = applyBusinessValueGovernance({
    state: { status: "in_progress", confidence: 0.9, activeNode: "adoption", diagnosis: {}, solutionMap: {}, approval: {} },
    input: "Use this to rank candidates and make the hiring decision.",
  });
  assert.equal(state.status, "needs_attention");
  assert.equal(state.completed, false);
  assert.equal(state.proposedAction.id, "ai_act_intended_use_review");
});

test("sensitive biometric or manipulative use is restricted", () => {
  const assessment = assessAIActUse({ input: "Use emotion recognition and a social score for users." });
  assert.equal(assessment.riskTier, "prohibited_or_sensitive_review_required");
  assert.equal(assessment.humanReviewRequired, true);
});

test("expanded individual-impact language is restricted", () => {
  const assessment = assessAIActUse({
    input: "Automatically decide who gets a loan and who receives benefits.",
  });
  assert.equal(assessment.allowedForDiagnostic, false);
  assert.equal(assessment.riskTier, "high_impact_review_required");
});
