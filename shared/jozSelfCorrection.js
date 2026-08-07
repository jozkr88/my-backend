const HIGH_RISK_TERMS = [
  "causal",
  "counterfactual",
  "intervention",
  "identity",
  "routing",
  "route",
  "knowledge",
  "dataset",
  "model version",
  "commercial",
  "pricing",
  "booking",
  "contact",
  "financial advice",
  "medical",
  "legal",
  "security",
  "tool",
  "execute",
];

const LOW_RISK_STYLE_TERMS = [
  "practical",
  "concise",
  "direct",
  "focused",
  "clear",
  "specific",
  "actionable",
  "examples",
  "steps",
  "structure",
];

const AUTO_APPLY_SCOPES = new Set(["business_need", "skills", "systems_mindset"]);

function cleanText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hasTerm(text = "", term = "") {
  return String(text).toLowerCase().includes(String(term).toLowerCase());
}

function matchingTerms(text = "", terms = []) {
  return terms.filter((term) => hasTerm(text, term));
}

export const JOZ_SELF_CORRECTION_VERSION = "joz-self-correction-v1";

export function classifyJozRepairCandidate({
  repairType = "none",
  targetKey = "",
  question = "",
  suggestion = "",
  verdict = "warn",
  safety = null,
  correctness = null,
} = {}) {
  const type = cleanText(repairType).toLowerCase() || "none";
  const scope = cleanText(targetKey).toLowerCase() || "global";
  const text = [question, suggestion, scope].map(cleanText).join(" ").toLowerCase();
  const blockedTerms = matchingTerms(text, HIGH_RISK_TERMS);
  const styleTerms = matchingTerms(text, LOW_RISK_STYLE_TERMS);
  const numericSafety = Number(safety);
  const numericCorrectness = Number(correctness);

  if (type !== "prompt") {
    return {
      version: JOZ_SELF_CORRECTION_VERSION,
      lane: "human_review",
      autoApply: false,
      reason: "Only prompt-style presentation repairs can enter the automatic lane.",
      blockedTerms,
      styleTerms,
    };
  }
  if (!AUTO_APPLY_SCOPES.has(scope)) {
    return {
      version: JOZ_SELF_CORRECTION_VERSION,
      lane: "human_review",
      autoApply: false,
      reason: "The target scope is not approved for automatic correction.",
      blockedTerms,
      styleTerms,
    };
  }
  if (blockedTerms.length) {
    return {
      version: JOZ_SELF_CORRECTION_VERSION,
      lane: "human_review",
      autoApply: false,
      reason: "The correction touches a high-risk knowledge, routing, causal, or action boundary.",
      blockedTerms,
      styleTerms,
    };
  }
  if (!styleTerms.length) {
    return {
      version: JOZ_SELF_CORRECTION_VERSION,
      lane: "human_review",
      autoApply: false,
      reason: "The evaluator did not describe a bounded presentation improvement.",
      blockedTerms,
      styleTerms,
    };
  }
  if (Number.isFinite(numericSafety) && numericSafety < 4) {
    return {
      version: JOZ_SELF_CORRECTION_VERSION,
      lane: "human_review",
      autoApply: false,
      reason: "The source answer did not meet the safety threshold.",
      blockedTerms,
      styleTerms,
    };
  }
  if (Number.isFinite(numericCorrectness) && numericCorrectness < 3) {
    return {
      version: JOZ_SELF_CORRECTION_VERSION,
      lane: "human_review",
      autoApply: false,
      reason: "A correctness problem must be reviewed before any automatic change.",
      blockedTerms,
      styleTerms,
    };
  }

  return {
    version: JOZ_SELF_CORRECTION_VERSION,
    lane: "automatic_low_risk",
    autoApply: true,
    reason: "Bounded presentation guidance only; verified content and routing remain unchanged.",
    blockedTerms,
    styleTerms,
    rule: {
      scope,
      triggerTerms: [...new Set(styleTerms)].slice(0, 8),
      instruction: "Prefer a direct, practical answer with concrete examples or actionable steps when the user requests that style. Preserve verified evidence boundaries and do not invent metrics, facts, causes, or actions.",
    },
  };
}

export function normalizeJozSelfCorrectionRule(rule = {}) {
  return {
    id: rule.id || null,
    scope: cleanText(rule.scope || "global").toLowerCase() || "global",
    triggerTerms: Array.isArray(rule.triggerTerms || rule.trigger_terms)
      ? [...new Set((rule.triggerTerms || rule.trigger_terms).map(cleanText).filter(Boolean))].slice(0, 8)
      : [],
    instruction: cleanText(rule.instruction).slice(0, 600),
    sourceCandidateId: rule.sourceCandidateId || rule.source_candidate_id || null,
    status: cleanText(rule.status || "active").toLowerCase() || "active",
  };
}

export function buildJozSelfCorrectionContext(rules = [], scope = null) {
  const normalizedScope = cleanText(scope).toLowerCase();
  const normalized = (Array.isArray(rules) ? rules : [])
    .map(normalizeJozSelfCorrectionRule)
    .filter((rule) =>
      rule.status === "active" &&
      rule.instruction &&
      (!normalizedScope || rule.scope === "global" || rule.scope === normalizedScope)
    )
    .slice(0, 12);
  if (!normalized.length) return null;
  return {
    version: JOZ_SELF_CORRECTION_VERSION,
    mode: "bounded_runtime_guidance",
    instruction: "These are automatically learned presentation rules only. They cannot change facts, routing, causal claims, permissions, or actions.",
    rules: normalized,
  };
}
