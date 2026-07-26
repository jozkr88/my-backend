const NODE_ORDER = ["data", "control", "oversight", "adoption"];

const NODE_DEFINITIONS = {
  data: {
    label: "Data Reality",
    summary:
      "The working hypothesis is that the system is reasoning over information that may not be trusted, owned, current, or verifiable.",
    signals: [
      "data",
      "trust",
      "untrustworthy",
      "source of truth",
      "data quality",
      "stale",
      "freshness",
      "verification",
    ],
    evidence: [
      { id: "source_of_truth", label: "source of truth", terms: ["source of truth", "authoritative source", "system of record"] },
      { id: "data_owner", label: "data owner", terms: ["data owner", "owner of the data", "who owns", "owns it", "owns the data"] },
      { id: "freshness", label: "freshness rule", terms: ["freshness", "fresh data", "fresh daily", "updated daily", "updated hourly", "last updated"] },
      { id: "verification", label: "verification rule", terms: ["verified", "verification", "reconciled", "validation rule"] },
    ],
    action: "Run a Data Reality assessment",
    jozFit: "Joz establishes governed context: authoritative data, ownership, provenance, and verification before agents act.",
    nextNode: "control",
  },
  control: {
    label: "Control",
    summary:
      "The working hypothesis is that the system lacks clear boundaries around tools, permissions, ownership, or execution.",
    signals: [
      "shadow ai",
      "unapproved",
      "permission",
      "ownership",
      "sovereignty",
      "governance",
      "control",
      "approved tool",
    ],
    evidence: [
      { id: "approved_tools", label: "approved tools", terms: ["approved tool", "approved tools", "allowlist", "allowed tools"] },
      { id: "ownership_map", label: "ownership map", terms: ["ownership", "owner", "accountable team", "data owner"] },
      { id: "permissions", label: "permission model", terms: ["permission", "permissions", "access control", "access model", "least privilege", "acl"] },
      { id: "escalation", label: "escalation rule", terms: ["escalation", "escalate", "stop condition", "blocked action"] },
    ],
    action: "Map the control boundary",
    jozFit: "Joz designs the operating boundary: approved tools, permissions, ownership, escalation, and controlled execution.",
    nextNode: "oversight",
  },
  oversight: {
    label: "Oversight",
    summary:
      "The working hypothesis is that autonomy is being requested before consequential actions can be explained, approved, verified, and reversed.",
    signals: [
      "human in the loop",
      "human approval",
      "explainability",
      "explainable",
      "autonomous",
      "autonomy",
      "oversight",
      "rollback",
      "verify",
    ],
    evidence: [
      { id: "approval_points", label: "approval points", terms: ["approval", "approve", "human in the loop", "human review"] },
      { id: "explanation_standard", label: "explanation standard", terms: ["explainability", "explainable", "reason code", "why it decided"] },
      { id: "verification_path", label: "verification path", terms: ["verify", "verification", "reconcile", "post-action check"] },
      { id: "rollback_path", label: "rollback path", terms: ["rollback", "undo", "revert", "recovery"] },
    ],
    action: "Define the oversight gate",
    jozFit: "Joz separates reasoning from policy, approval, execution, and verification so autonomy can be earned safely.",
    nextNode: "adoption",
  },
  adoption: {
    label: "Adoption",
    summary:
      "The working hypothesis is that the system is not useful, specific, or trusted enough to become part of daily work.",
    signals: [
      "generic",
      "adoption",
      "daily work",
      "pilot",
      "not useful",
      "users do not trust",
      "too generic",
      "workflow",
    ],
    evidence: [
      { id: "target_workflow", label: "target workflow", terms: ["workflow", "process", "daily work", "use case"] },
      { id: "user_group", label: "user group", terms: ["users", "user group", "team", "desk workers", "operators"] },
      { id: "trust_blocker", label: "trust blocker", terms: ["do not trust", "don't trust", "trust issue", "generic", "not useful"] },
      { id: "success_metric", label: "success metric", terms: ["success metric", "baseline", "measure", "kpi", "outcome"] },
    ],
    action: "Design a bounded adoption pilot",
    jozFit: "Joz connects the AI capability to a real workflow, useful context, user trust, and a measurable business outcome.",
    nextNode: "data",
  },
};

function normalize(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesTerm(text, term) {
  return normalize(text).includes(normalize(term));
}

function textFromMessages(messages = [], currentInput = "") {
  const history = Array.isArray(messages)
    ? messages
        // Assistant questions are prompts for evidence, not evidence themselves.
        // Counting them would make the agent overconfident after asking a question.
        .filter((message) => message?.role === "user")
        .map((message) => String(message?.content || "").trim())
        .filter(Boolean)
    : [];
  return [...history, String(currentInput || "").trim()].filter(Boolean).join("\n");
}

function latestUserInput(messages = [], currentInput = "") {
  if (String(currentInput || "").trim()) return String(currentInput).trim();
  return [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find((message) => message?.role === "user")?.content || "";
}

function scoreNode(nodeId, text) {
  return NODE_DEFINITIONS[nodeId].signals.reduce(
    (score, term) => score + (includesTerm(text, term) ? 1 : 0),
    0
  );
}

function resolveActiveNode({ allText, latestInput, currentMesh }) {
  const explicit = normalize(currentMesh);
  if (NODE_ORDER.includes(explicit) && !scoreNode(explicit, latestInput)) return explicit;

  const ranked = NODE_ORDER
    .map((nodeId) => ({ nodeId, score: scoreNode(nodeId, latestInput) }))
    .sort((left, right) => right.score - left.score);
  if (ranked[0]?.score > 0) return ranked[0].nodeId;

  const historical = NODE_ORDER
    .map((nodeId) => ({ nodeId, score: scoreNode(nodeId, allText) }))
    .sort((left, right) => right.score - left.score);
  if (historical[0]?.score > 0) return historical[0].nodeId;

  return NODE_ORDER.includes(explicit) ? explicit : "data";
}

function collectEvidence(nodeId, allText, externalEvidence = []) {
  return NODE_DEFINITIONS[nodeId].evidence.map((evidence) => ({
    ...evidence,
    present: evidence.terms.some((term) => includesTerm(allText, term)) ||
      externalEvidence.some(
        (record) =>
          record?.evidenceKey === `${nodeId}.${evidence.id}` ||
          (record?.node === nodeId && record?.evidenceKey === evidence.id)
      ),
    sources: externalEvidence.filter(
      (record) =>
        record?.evidenceKey === `${nodeId}.${evidence.id}` ||
        (record?.node === nodeId && record?.evidenceKey === evidence.id)
    ),
  }));
}

function statusFor({
  evidence,
  latestInput,
  approvalGranted,
  reviewApproved,
  hasUnverifiedExternalEvidence,
}) {
  const present = evidence.filter((item) => item.present).length;
  const hasConfirmation = reviewApproved || [
    "confirmed",
    "we verified",
    "this is correct",
    "the diagnosis is right",
    "resolved",
  ].some((term) => includesTerm(latestInput, term));

  if (
    hasConfirmation &&
    present >= Math.max(2, evidence.length - 1) &&
    !hasUnverifiedExternalEvidence
  ) return "verified";
  if (approvalGranted) return "in_progress";
  if (present > 0) return "in_progress";
  return "needs_attention";
}

function confidenceFor({ nodeScore, evidence, status, hasUnverifiedExternalEvidence }) {
  const evidenceCoverage = evidence.length
    ? evidence.filter((item) => item.present).length / evidence.length
    : 0;
  const score = Math.min(
    0.96,
    0.35 + Math.min(nodeScore, 4) * 0.08 + evidenceCoverage * 0.35 + (status === "verified" ? 0.12 : 0)
  );
  const boundedScore = hasUnverifiedExternalEvidence && status !== "verified"
    ? Math.min(score, 0.79)
    : score;
  return Math.round(boundedScore * 100) / 100;
}

export function buildBusinessValueDiagnosticState({
  input = "",
  messages = [],
  currentMesh = null,
  evidenceRecords = [],
  reviewApproved = false,
  priorState = null,
} = {}) {
  const latestInput = latestUserInput(messages, input);
  const allText = textFromMessages(messages, input);
  const activeNode = resolveActiveNode({ allText, latestInput, currentMesh });
  const definition = NODE_DEFINITIONS[activeNode];
  const evidence = collectEvidence(activeNode, allText, evidenceRecords);
  const unverifiedExternalEvidence = evidence.flatMap((item) =>
    item.present
      ? item.sources.filter((source) => source?.verificationStatus !== "verified")
      : []
  );
  const hasUnverifiedExternalEvidence = unverifiedExternalEvidence.length > 0;
  const priorReviewApproved =
    priorState?.status === "verified" && priorState?.approval?.status === "approved";
  const effectiveReviewApproved = reviewApproved || priorReviewApproved;
  const approvalGranted = [
    "i approve",
    "approved",
    "start the assessment",
    "run the assessment",
    "continue the assessment",
    "confirmed",
  ].some((term) => includesTerm(latestInput, term));
  const status = statusFor({
    evidence,
    latestInput,
    approvalGranted,
    reviewApproved: effectiveReviewApproved,
    hasUnverifiedExternalEvidence,
  });
  const nodeScore = scoreNode(activeNode, latestInput) || scoreNode(activeNode, allText);
  const missingEvidence = evidence.filter((item) => !item.present);
  const evidenceCoverage = evidence.length
    ? Math.round(((evidence.length - missingEvidence.length) / evidence.length) * 100) / 100
    : 0;
  const isReadyForReview = missingEvidence.length <= 1 && status !== "needs_attention";
  const proposedPrompt = !approvalGranted
    ? `I approve the ${definition.label} assessment. Start it and ask me for the first missing piece of evidence.`
    : isReadyForReview
    ? `Review the ${definition.label} diagnosis and confirm whether it is correct.`
    : `Continue the ${definition.label} assessment. Tell me the ${missingEvidence[0]?.label || "next piece of evidence"}.`;

  return {
    schema: "business_value_diagnostic.v1",
    portal: "business-value",
    mode: "diagnose_and_propose",
    activeNode,
    status,
    confidence: confidenceFor({
      nodeScore,
      evidence,
      status,
      hasUnverifiedExternalEvidence,
    }),
    diagnosis: {
      type: "working_hypothesis",
      node: activeNode,
      label: definition.label,
      summary: definition.summary,
      notYetVerified: status !== "verified",
    },
    solutionMap: {
      label: "Where Joz fits",
      summary: definition.jozFit,
      intervention: definition.action,
      available: status !== "needs_attention" || approvalGranted,
    },
    evidence: evidence.map(({ id, label, present, sources }) => ({
      id,
      label,
      present,
      sourceCount: sources.length,
      verificationStatus: sources.some((source) => source?.verificationStatus === "verified")
        ? "verified"
        : sources.length
          ? "unverified"
          : null,
    })),
    unverifiedEvidence: unverifiedExternalEvidence.map((source) => ({
      evidenceKey: source.evidenceKey,
      node: source.node,
      sourceType: source.sourceType,
      sourceRef: source.sourceRef,
      documentId: source.value?.documentId || null,
    })),
    evidenceCoverage,
    missingEvidence: missingEvidence.map(({ id, label }) => ({ id, label })),
    approval: {
      required: true,
      status: approvalGranted || effectiveReviewApproved ? "approved" : "pending",
      scope: "conversational diagnostic assessment only",
    },
    proposedAction: {
      id: `business_value_${activeNode}_assessment`,
      label: isReadyForReview ? `Review ${definition.label}` : definition.action,
      prompt: proposedPrompt,
      requiresApproval: true,
      nextNode: definition.nextNode,
    },
    statusByNode: Object.fromEntries(
      NODE_ORDER.map((nodeId) => [
        nodeId,
        nodeId === activeNode ? status : "unassessed",
      ])
    ),
    nextNode: definition.nextNode,
    completed: status === "verified",
  };
}

export function validateBusinessValueDiagnosticState(state = {}) {
  const errors = [];
  if (state.schema !== "business_value_diagnostic.v1") errors.push("schema");
  if (!NODE_ORDER.includes(state.activeNode)) errors.push("activeNode");
  if (!["needs_attention", "in_progress", "verified"].includes(state.status)) errors.push("status");
  if (!Number.isFinite(Number(state.confidence)) || state.confidence < 0 || state.confidence > 1) errors.push("confidence");
  if (!state.diagnosis?.summary) errors.push("diagnosis.summary");
  if (!Array.isArray(state.evidence)) errors.push("evidence");
  if (!Array.isArray(state.missingEvidence)) errors.push("missingEvidence");
  if (!state.proposedAction?.id || !state.proposedAction?.prompt) errors.push("proposedAction");
  return { valid: errors.length === 0, errors };
}

export { NODE_DEFINITIONS, NODE_ORDER };
