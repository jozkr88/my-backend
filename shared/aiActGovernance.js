export const AI_ACT_GOVERNANCE_VERSION = "2026-07-26";

export const AI_DISCLOSURE_TEXT =
  "You are interacting with Joz MAXX, an AI system. Responses are generated with AI, may be wrong, and require human review before consequential decisions or actions.";

export const AI_MACHINE_READABLE_DISCLOSURE = {
  aiGenerated: true,
  system: "Joz MAXX",
  governanceVersion: AI_ACT_GOVERNANCE_VERSION,
  humanReviewRequiredForConsequentialUse: true,
};

export const JOZ_AI_SYSTEM_CARD = {
  schema: "joz.ai_system_card.v1",
  version: AI_ACT_GOVERNANCE_VERSION,
  name: "Joz MAXX",
  providerRole:
    "Joz / Jozef Krupa operates the application-level AI system. Model and infrastructure providers are third-party processors or upstream model providers where configured.",
  intendedPurpose: [
    "Explain Joz's experience and capabilities.",
    "Help users understand organizational AI, data, governance, oversight, and adoption concepts.",
  ],
  notIntendedFor: [
    "Making or recommending decisions about an identifiable person's employment, hiring, promotion, dismissal, pay, credit, insurance, healthcare, education, benefits, immigration, law enforcement, or biometric status.",
    "Fully autonomous execution of consequential actions.",
    "Replacing legal, regulatory, security, clinical, financial, HR, or other professional judgment.",
  ],
  modelBehavior: {
    outputs: "Generated text and structured interaction metadata.",
    uncertainty: "The system can be wrong or incomplete; confidence is not proof.",
    humanOversight: "A human must review outputs before consequential decisions or actions. Consequential actions require separate approval gates.",
  },
  data: {
    inputs: ["Chat messages", "Optional voice transcripts", "User-submitted company evidence", "Technical and security metadata"],
    processing: "Inputs may be processed by configured hosting, database, model, email, and observability providers.",
    controls: ["Tenant/company scoping", "Access controls", "Evidence provenance", "Retention and deletion workflows", "Audit events"],
  },
  safeguards: [
    "AI interaction disclosure in chat and voice surfaces.",
    "Deterministic routing and policy boundaries outside the model.",
    "High-impact-use guardrails and human review requirements.",
    "Request, decision, approval, and incident auditability.",
    "Evaluation and adversarial regression tests.",
  ],
  contact: "joz@meetjoz.com",
  reviewStatus: "engineering-readiness-draft; legal and DPO review required before commercial assurance",
};

const PROHIBITED_PATTERNS = [
  {
    category: "prohibited_or_sensitive_biometric_use",
    label: "biometric identification, categorisation, or emotion recognition",
    terms: [
      "biometric identification",
      "facial recognition",
      "emotion recognition",
      "infer emotion from voice",
      "infer emotions from voice",
      "biometric categorisation",
    ],
  },
  {
    category: "social_scoring_or_manipulation",
    label: "social scoring or manipulative exploitation",
    terms: [
      "social score",
      "social scoring",
      "manipulate vulnerable",
      "subliminal manipulation",
      "exploit vulnerable people",
      "target vulnerable people with persuasion",
      "manipulate a person into a decision",
    ],
  },
];

const HIGH_IMPACT_PATTERNS = [
  {
    category: "employment_or_worker_management",
    label: "employment or worker-management use",
    terms: [
      "screen applicants",
      "screen candidates",
      "rank candidates",
      "hire candidates",
      "hiring decision",
      "employee performance",
      "performance rating",
      "promote an employee",
      "fire an employee",
      "dismiss an employee",
      "job application scoring",
      "decide who gets hired",
      "decide who to fire",
      "decide who gets promoted",
      "automated employment decision",
    ],
  },
  {
    category: "credit_insurance_or_essential_services",
    label: "credit, insurance, healthcare, or essential-service eligibility",
    terms: [
      "credit score a person",
      "creditworthiness",
      "loan approval",
      "insurance pricing",
      "insurance eligibility",
      "healthcare eligibility",
      "benefit eligibility",
      "deny benefits",
      "essential service eligibility",
      "decide who gets a loan",
      "decide who gets insurance",
      "decide who receives benefits",
    ],
  },
  {
    category: "education_or_vulnerable_person_assessment",
    label: "education or vulnerable-person assessment",
    terms: [
      "grade a student",
      "score a student",
      "student admission",
      "assess a child",
      "assess vulnerable people",
      "decide admission for a student",
      "decide a student's grade",
    ],
  },
  {
    category: "law_enforcement_migration_or_democratic_process",
    label: "law-enforcement, migration, border, or democratic-process use",
    terms: [
      "law enforcement risk",
      "predict crime",
      "immigration decision",
      "border decision",
      "asylum decision",
      "political persuasion targeting",
      "election influence targeting",
      "decide asylum eligibility",
    ],
  },
];

function normalize(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findMatches(text, definitions) {
  return definitions
    .filter((definition) => definition.terms.some((term) => text.includes(normalize(term))))
    .map((definition) => ({ category: definition.category, label: definition.label }));
}

export function assessAIActUse({ input = "", messages = [], evidenceText = "" } = {}) {
  const history = Array.isArray(messages)
    ? messages.filter((message) => message?.role === "user").map((message) => message.content || "")
    : [];
  const text = normalize([input, ...history, evidenceText].filter(Boolean).join("\n"));
  const prohibitedMatches = findMatches(text, PROHIBITED_PATTERNS);
  const highImpactMatches = findMatches(text, HIGH_IMPACT_PATTERNS);

  if (prohibitedMatches.length) {
    return {
      status: "restricted",
      riskTier: "prohibited_or_sensitive_review_required",
      matchedCategories: prohibitedMatches,
      reason: "This use may involve a prohibited or specially restricted practice and cannot be handled as an ordinary Business Value diagnosis.",
      humanReviewRequired: true,
      allowedForDiagnostic: false,
    };
  }

  if (highImpactMatches.length) {
    return {
      status: "restricted",
      riskTier: "high_impact_review_required",
      matchedCategories: highImpactMatches,
      reason: "This use may affect people in a high-impact domain. Joz must not make or recommend the individual decision; legal, compliance, and human-rights review is required.",
      humanReviewRequired: true,
      allowedForDiagnostic: false,
    };
  }

  return {
    status: "clear_with_transparency",
    riskTier: "limited_risk_transparency",
    matchedCategories: [],
    reason: "Organizational diagnostic use detected; continue to disclose AI involvement and keep conclusions as human-reviewed hypotheses.",
    humanReviewRequired: false,
    allowedForDiagnostic: true,
  };
}

export function buildAIActRestrictedReply(assessment) {
  const reason = String(
    assessment?.reason ||
      "This request may involve a regulated or high-impact decision context."
  ).trim();
  return [
    "I can’t help make or recommend that individual-impact decision.",
    reason,
    "I can help design the governance, evidence, oversight, and human-review process around it. A qualified human, legal, compliance, and—where relevant—DPO reviewer must confirm the intended use before proceeding.",
  ].join("\n\n");
}

export function applyBusinessValueGovernance({ state, input = "", messages = [], evidenceText = "" } = {}) {
  const assessment = assessAIActUse({ input, messages, evidenceText });
  if (assessment.allowedForDiagnostic) {
    return { ...state, governance: assessment };
  }

  return {
    ...state,
    status: "needs_attention",
    confidence: Math.min(Number(state?.confidence || 0), 0.35),
    completed: false,
    governance: assessment,
    diagnosis: {
      ...(state?.diagnosis || {}),
      type: "restricted_use_review",
      notYetVerified: true,
      summary: assessment.reason,
    },
    solutionMap: {
      ...(state?.solutionMap || {}),
      available: false,
      summary: "Joz cannot provide an individual-impact decision or bypass the required human, legal, and compliance review.",
    },
    approval: {
      ...(state?.approval || {}),
      required: true,
      status: "pending",
      scope: "human and compliance review of intended use",
    },
    proposedAction: {
      id: "ai_act_intended_use_review",
      label: "Review intended use",
      prompt: "This request may affect people in a regulated or high-impact context. Confirm that Joz will only help design safeguards and will not make or recommend the individual decision.",
      requiresApproval: true,
      nextNode: state?.activeNode || "data",
    },
  };
}
