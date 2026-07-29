import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBusinessValueDiagnosticState,
  validateBusinessValueDiagnosticState,
} from "./shared/businessValueDiagnostic.js";
import { ingestBusinessValueDocument } from "./shared/businessValueEvidence.js";

test("frames a vague AI problem as a hypothesis instead of claiming certainty", () => {
  const state = buildBusinessValueDiagnosticState({
    input: "Our AI is not delivering value.",
  });

  assert.equal(state.diagnosis.type, "working_hypothesis");
  assert.equal(state.diagnosis.notYetVerified, true);
  assert.equal(state.status, "needs_attention");
  assert.equal(state.approval.status, "pending");
  assert.ok(state.missingEvidence.length > 0);
  assert.equal(validateBusinessValueDiagnosticState(state).valid, true);
});

test("routes generic outputs to adoption and asks for a bounded workflow", () => {
  const state = buildBusinessValueDiagnosticState({
    input: "The outputs are too generic and users do not find the pilot useful.",
  });

  assert.equal(state.activeNode, "adoption");
  assert.match(state.diagnosis.summary, /daily work/i);
  assert.ok(state.missingEvidence.some((item) => item.id === "target_workflow"));
  assert.equal(state.proposedAction.requiresApproval, true);
  assert.equal(state.approval.status, "pending");
});

test("accumulates evidence without marking a diagnosis verified too early", () => {
  const state = buildBusinessValueDiagnosticState({
    messages: [
      { role: "user", content: "The source of truth is our finance warehouse." },
      { role: "assistant", content: "Who owns the data and how is freshness checked?" },
      { role: "user", content: "Finance owns it and freshness is checked daily." },
    ],
    input: "We still need the final check.",
  });

  assert.equal(state.activeNode, "data");
  assert.equal(state.status, "in_progress");
  assert.equal(state.evidenceCoverage, 0.75);
  assert.equal(state.completed, false);
  assert.equal(state.approval.status, "pending");
});

test("requires explicit confirmation before moving a nearly complete diagnosis to verified", () => {
  const state = buildBusinessValueDiagnosticState({
    messages: [
      { role: "user", content: "The source of truth is our finance warehouse." },
      { role: "user", content: "Finance owns it, data is fresh daily, and the result is reconciled." },
    ],
    input: "The diagnosis is right; confirmed.",
  });

  assert.equal(state.activeNode, "data");
  assert.equal(state.status, "verified");
  assert.equal(state.completed, true);
  assert.equal(state.missingEvidence.length, 0);
  assert.equal(state.approval.status, "approved");
});

test("maps control concerns to permissions and escalation evidence", () => {
  const state = buildBusinessValueDiagnosticState({
    input: "We have unapproved AI tools and no documented boundaries or escalation rules.",
  });

  assert.equal(state.activeNode, "control");
  assert.ok(state.missingEvidence.some((item) => item.id === "approved_tools"));
  assert.ok(state.missingEvidence.some((item) => item.id === "ownership_map"));
  assert.ok(state.missingEvidence.some((item) => item.id === "permissions"));
});

test("extracts document evidence as unverified candidates", () => {
  const ingestion = ingestBusinessValueDocument({
    title: "AI operating model",
    sourceType: "uploaded_policy",
    content:
      "Finance owns the source of truth. Data is refreshed daily and reconciled before reporting. Approved tools are allowlisted, with escalation required for blocked actions.",
  });

  assert.equal(ingestion.document.verificationStatus, "unverified");
  assert.ok(ingestion.candidates.some((item) => item.evidenceKey === "data.source_of_truth"));
  assert.ok(ingestion.candidates.some((item) => item.evidenceKey === "control.approved_tools"));
  assert.ok(ingestion.candidates.every((item) => item.verificationStatus === "unverified"));

  const state = buildBusinessValueDiagnosticState({
    currentMesh: "data",
    evidenceRecords: ingestion.candidates,
  });
  assert.equal(state.status, "in_progress");
  assert.equal(state.evidence[0].verificationStatus, "unverified");
  assert.ok(state.unverifiedEvidence.length > 0);
  assert.equal(state.completed, false);
});

test("does not let an unverified document claim become a verified diagnosis", () => {
  const ingestion = ingestBusinessValueDocument({
    title: "Readiness notes",
    content:
      "The source of truth is the finance warehouse. Finance owns the data, freshness is checked daily, and the result is reconciled.",
  });

  const state = buildBusinessValueDiagnosticState({
    currentMesh: "data",
    input: "The diagnosis is right; confirmed.",
    evidenceRecords: ingestion.candidates,
  });

  assert.equal(state.status, "in_progress");
  assert.equal(state.diagnosis.notYetVerified, true);
  assert.equal(state.completed, false);
});

test("permits verification only after every candidate is reviewed", () => {
  const ingestion = ingestBusinessValueDocument({
    title: "Reviewed readiness notes",
    content:
      "The source of truth is the finance warehouse. Finance owns the data, freshness is checked daily, and the result is reconciled.",
  });
  const reviewedEvidence = ingestion.candidates.map((item) => ({
    ...item,
    verificationStatus: "verified",
  }));

  const state = buildBusinessValueDiagnosticState({
    currentMesh: "data",
    evidenceRecords: reviewedEvidence,
    reviewApproved: true,
  });

  assert.equal(state.status, "verified");
  assert.equal(state.completed, true);
  assert.equal(state.approval.status, "approved");
});
