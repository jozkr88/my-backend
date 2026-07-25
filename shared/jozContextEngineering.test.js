import test from "node:test";
import assert from "node:assert/strict";

import {
  buildJozContextPacket,
  estimateContextTokens,
  isContextDocumentAuthorized,
} from "./jozContextEngineering.js";

test("builds a structured context packet with provenance and source priority", () => {
  const packet = buildJozContextPacket({
    input: "How does Joz verify agent actions?",
    messages: [
      { role: "user", content: "How does Joz design agentic systems?" },
      { role: "assistant", content: "He separates policy, execution, and verification." },
    ],
    context: { currentPortal: "meet-joz", currentMesh: "skills", targetRole: "CTO" },
    intentMode: "skills",
    route: {
      selectedRoute: "skills",
      detectedSubIntent: "verification_architecture",
      detectedConcept: "verification",
    },
    intentClassification: {
      kind: "answer",
      domain: "joz_scoped",
      confidenceBand: "high",
      risk: "low",
    },
    retrievedDocuments: [
      {
        title: "Verification architecture",
        category: "skills",
        summary: "Verify expected versus actual state against an authoritative source.",
        metadata: {
          slug: "verification-architecture",
          verification_status: "verified",
          updated_at: "2026-07-20T00:00:00.000Z",
        },
      },
    ],
    identity: { name: "Jozef Krupa" },
    cv: {
      headline: "Agentic AI architect",
      experienceSummary: { overallYears: "13+", mlAiYears: "8+" },
      appliedAiSkills: { architecture: ["RAG", "verification"] },
    },
  });

  assert.equal(packet.schema, "joz.context.v1");
  assert.equal(packet.request.subIntent, "verification_architecture");
  assert.equal(packet.runtime.targetRole, "CTO");
  assert.equal(packet.retrieval.documents.length, 1);
  assert.equal(packet.retrieval.documents[0].verificationStatus, "verified");
  assert.equal(packet.provenance.aclApplied, true);
  assert.ok(packet.budget.totalTokens > 0);
  assert.equal(typeof packet.budget.withinBudget, "boolean");
});

test("filters unauthorized and stale sources before they reach model context", () => {
  const packet = buildJozContextPacket({
    input: "What does the company know about X?",
    context: { requireFreshContext: true, userRoles: ["employee"] },
    retrievedDocuments: [
      {
        title: "Private finance record",
        summary: "Should not be included.",
        metadata: { visibility: "private", allowed_roles: ["finance"] },
      },
      {
        title: "Stale public record",
        summary: "Should not be included when freshness is required.",
        metadata: { visibility: "public", updated_at: "2020-01-01T00:00:00.000Z" },
      },
      {
        title: "Current public record",
        summary: "Safe to include.",
        metadata: { visibility: "public", updated_at: "2026-07-20T00:00:00.000Z" },
      },
    ],
  });

  assert.deepEqual(packet.retrieval.documents.map((doc) => doc.title), ["Current public record"]);
  assert.equal(packet.retrieval.excluded.length, 2);
  assert.deepEqual(
    packet.retrieval.excluded.map((item) => item.reason).sort(),
    ["acl_denied", "stale_source"].sort()
  );
});

test("keeps execution context approval-bound and estimates budget deterministically", () => {
  const packet = buildJozContextPacket({
    input: "Deploy this change to production",
    intentClassification: { kind: "execute", risk: "high", needsClarification: false },
    agentPlan: { action: "deploy_change" },
  });

  assert.equal(packet.risk.execution, "approval_required");
  assert.equal(estimateContextTokens("1234"), 1);
  assert.equal(isContextDocumentAuthorized({ metadata: { visibility: "public" } }, {}), true);
  assert.equal(
    isContextDocumentAuthorized(
      { metadata: { visibility: "private", allowed_roles: ["admin"] } },
      { userRoles: ["employee"] }
    ),
    false
  );
});
