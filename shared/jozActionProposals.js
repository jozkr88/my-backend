import crypto from "node:crypto";

const proposals = new Map();

function hashToken(token = "") {
  return crypto.createHash("sha256").update(String(token), "utf8").digest("hex");
}

function sanitizeProposal(entry) {
  if (!entry) return null;
  return {
    ...entry.proposal,
    status: entry.status,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
    approvedAt: entry.approvedAt || null,
    approvedBy: entry.approvedBy || null,
    executed: false,
  };
}

export function registerJozActionProposal({ proposal = {}, sessionKey = null } = {}) {
  const proposalId = String(proposal.proposalId || `proposal_${crypto.randomUUID()}`);
  const token = crypto.randomBytes(24).toString("base64url");
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + Number(proposal.expiresInSeconds || 300) * 1000).toISOString();
  const entry = {
    proposal: { ...proposal, proposalId, expiresAt },
    sessionKey: sessionKey || null,
    status: "pending",
    createdAt,
    expiresAt,
    tokenHash: hashToken(token),
    executionTokenHash: null,
  };

  proposals.set(proposalId, entry);

  return {
    proposal: sanitizeProposal(entry),
    approval: {
      status: "pending",
      token,
      expiresAt,
      oneTime: true,
    },
  };
}

export function getJozActionProposalRecord(proposalId = "") {
  const entry = proposals.get(String(proposalId));
  return entry ? { ...entry, proposal: { ...entry.proposal } } : null;
}

export function hydrateJozActionProposal(entry = null) {
  if (!entry?.proposal?.proposalId) return null;
  proposals.set(String(entry.proposal.proposalId), {
    ...entry,
    proposal: { ...entry.proposal },
  });
  return sanitizeProposal(entry);
}

export function approveJozActionProposal({ proposalId = "", token = "", approvedBy = "chat" } = {}) {
  const entry = proposals.get(String(proposalId));
  if (!entry) return { ok: false, status: 404, error: "Action proposal not found" };
  if (entry.status !== "pending") return { ok: false, status: 409, error: `Proposal is already ${entry.status}` };
  if (Date.now() >= new Date(entry.expiresAt).getTime()) {
    entry.status = "expired";
    return { ok: false, status: 410, error: "Action proposal has expired" };
  }
  if (!token || hashToken(token) !== entry.tokenHash) {
    return { ok: false, status: 403, error: "Invalid approval token" };
  }

  entry.status = "approved_not_executed";
  entry.approvedAt = new Date().toISOString();
  entry.approvedBy = String(approvedBy || "chat").slice(0, 200);
  const executionToken = crypto.randomBytes(24).toString("base64url");
  entry.executionTokenHash = hashToken(executionToken);
  return {
    ok: true,
    proposal: sanitizeProposal(entry),
    approval: {
      status: "approved",
      executionToken,
      oneTime: true,
    },
    execution: {
      status: "approved_not_executed",
      proposed: true,
      approved: true,
      executed: false,
    },
  };
}

export function beginJozActionExecution({ proposalId = "", executionToken = "" } = {}) {
  const entry = proposals.get(String(proposalId));
  if (!entry) return { ok: false, status: 404, error: "Action proposal not found" };
  if (entry.status !== "approved_not_executed") return { ok: false, status: 409, error: `Proposal is ${entry.status}` };
  if (Date.now() >= new Date(entry.expiresAt).getTime()) {
    entry.status = "expired";
    return { ok: false, status: 410, error: "Action proposal has expired" };
  }
  if (!executionToken || hashToken(executionToken) !== entry.executionTokenHash) {
    return { ok: false, status: 403, error: "Invalid execution token" };
  }

  entry.status = "executing";
  entry.executionTokenHash = null;
  return { ok: true, proposal: sanitizeProposal(entry) };
}

export function completeJozActionExecution({ proposalId = "", result = null, verification = {} } = {}) {
  const entry = proposals.get(String(proposalId));
  if (!entry) return null;
  const verified = Boolean(verification?.verified);
  entry.status = verified ? "verified" : "verification_failed";
  entry.result = result;
  entry.verification = verification;
  entry.completedAt = new Date().toISOString();
  return {
    proposal: sanitizeProposal(entry),
    result,
    verification,
    execution: {
      status: verified ? "verified" : "verification_failed",
      proposed: true,
      approved: true,
      executed: true,
    },
  };
}

export function clearJozActionProposals() {
  proposals.clear();
}
