import test from "node:test";
import assert from "node:assert/strict";

import {
  approveJozActionProposal,
  clearJozActionProposals,
  getJozActionProposalRecord,
  hydrateJozActionProposal,
  registerJozActionProposal,
} from "./jozActionProposals.js";

test("action proposals require a valid one-time token and do not execute on approval", () => {
  clearJozActionProposals();
  const created = registerJozActionProposal({
    proposal: { action: "generate_report", expiresInSeconds: 300 },
  });

  const approved = approveJozActionProposal({
    proposalId: created.proposal.proposalId,
    token: created.approval.token,
    approvedBy: "test",
  });

  assert.equal(approved.ok, true);
  assert.equal(approved.execution.status, "approved_not_executed");
  assert.equal(approved.execution.executed, false);

  const replay = approveJozActionProposal({
    proposalId: created.proposal.proposalId,
    token: created.approval.token,
  });
  assert.equal(replay.status, 409);
});

test("action proposals reject invalid tokens", () => {
  clearJozActionProposals();
  const created = registerJozActionProposal({ proposal: { action: "requested_action" } });
  const rejected = approveJozActionProposal({
    proposalId: created.proposal.proposalId,
    token: "wrong-token",
  });

  assert.equal(rejected.status, 403);
});

test("action proposals can be hydrated after a process restart", () => {
  clearJozActionProposals();
  const created = registerJozActionProposal({
    proposal: { action: "generate_report", risk: "low", expiresInSeconds: 300 },
  });
  const record = getJozActionProposalRecord(created.proposal.proposalId);
  clearJozActionProposals();

  hydrateJozActionProposal(record);
  const approved = approveJozActionProposal({
    proposalId: created.proposal.proposalId,
    token: created.approval.token,
  });

  assert.equal(approved.ok, true);
  assert.equal(approved.proposal.status, "approved_not_executed");
  clearJozActionProposals();
});
