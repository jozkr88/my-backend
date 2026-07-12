import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveRepoRoot() {
  const candidates = [
    process.cwd(),
    path.resolve(__dirname, "..", ".."),
    path.resolve(__dirname, ".."),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "data", "joz", "published"))) {
      return candidate;
    }
  }

  return candidates[0];
}

const repoRoot = resolveRepoRoot();
const publishedOntologyPath = path.join(
  repoRoot,
  "data",
  "joz",
  "published",
  "joz-ontology.generated.json"
);

const PRIORITY_WEIGHTS = {
  hero: 20,
  high: 12,
  standard: 5,
  supporting: 0,
};

const VERIFICATION_WEIGHTS = {
  cv_supported: 30,
  verified: 26,
  project_supported: 24,
  positioning_supported: 23,
  capability_supported: 21,
  needs_review: 8,
  draft: 0,
};

const QUERY_FIELD_WEIGHTS = {
  problems: 8,
  principles: 6,
  capabilities: 7,
  outcomes: 7,
  governance: 5,
  industries: 4,
  proofs: 10,
};

const FIELD_KEYWORDS = {
  problems: {
    knowledge_fragmentation: ["fragmented knowledge", "knowledge fragmentation", "fragmented", "usable intelligence"],
    slow_decision_making: ["slow decision", "slow decisions", "decision speed", "faster decisions"],
    ai_adoption_failure: ["adoption", "ai adoption", "low adoption"],
    operational_friction: ["friction", "handoff", "workflow", "manual process", "operational"],
    data_silos: ["data silos", "silos", "disconnected systems"],
    governance_gaps: ["governance gaps", "lack of controls", "accountability"],
    low_trust: ["trust", "trusted", "confidence"],
    manual_knowledge_work: ["manual knowledge", "reconcile", "summarize", "research"],
    unclear_roi: ["roi", "value", "cost", "revenue", "outcome"],
    organizational_complexity: ["complex systems", "complexity", "organizational", "alignment"],
  },
  principles: {
    signal_over_noise: ["signal over noise", "signal", "noise"],
    context_creates_intelligence: ["context", "context creates intelligence"],
    systems_before_features: ["systems before features", "workflow before tools", "systems"],
    trust_before_autonomy: ["trust before autonomy", "trust", "autonomy"],
    human_accountability: ["accountability", "responsibility", "human oversight"],
    feedback_loops: ["feedback", "feedback loops", "learn from outcomes"],
    decision_quality: ["decision quality", "decision-making", "decision making"],
    appropriate_autonomy: ["appropriate autonomy", "autonomy", "human in the loop"],
  },
  capabilities: {
    agentic_ai: ["agentic ai", "agents", "agent architecture"],
    rag: ["rag", "retrieval", "retrieval augmented"],
    context_engineering: ["context engineering", "context"],
    decision_intelligence: ["decision intelligence", "decision support"],
    ai_governance: ["governance", "ai governance"],
    knowledge_graphs: ["knowledge graph", "knowledge graphs"],
    agent_memory: ["memory", "agent memory"],
    acl_aware_retrieval: ["acl", "permissions", "access-aware retrieval"],
    verification: ["verification", "grounding"],
    observability: ["observability", "telemetry", "monitoring"],
    multimodal_ai: ["multimodal", "voice", "gesture", "gaze", "haptics"],
    computer_vision: ["computer vision", "cv"],
    spatial_ai: ["spatial ai", "volumetric", "3d ui", "spatial"],
    enterprise_architecture: ["enterprise architecture", "architecture"],
    workflow_redesign: ["workflow redesign", "workflow"],
    rapid_prototyping: ["prototype", "prototyping", "rapid"],
    product_strategy: ["product strategy", "strategy"],
    organizational_design: ["organizational design", "operating model"],
  },
  outcomes: {
    revenue_growth: ["revenue", "sales growth", "growth"],
    higher_adoption: ["adoption", "usage"],
    faster_decisions: ["faster decisions", "decision speed"],
    lower_risk: ["risk", "safer"],
    cost_reduction: ["cost", "cost reduction"],
    productivity_gains: ["productivity", "efficiency"],
    lower_operational_friction: ["friction", "handoff"],
    better_customer_experience: ["customer experience", "cx", "experience"],
    higher_data_trust: ["data trust", "trust"],
    faster_time_to_value: ["time to value", "faster value"],
    knowledge_reuse: ["knowledge reuse", "reuse"],
    stronger_governance: ["governance", "controls"],
  },
  governance: {
    human_approval: ["human approval", "approval"],
    auditability: ["audit", "auditability"],
    source_provenance: ["source provenance", "provenance", "grounded"],
    access_control: ["access control", "permissions", "acl"],
    confidence_handling: ["confidence", "uncertainty"],
    evaluation: ["evaluation", "eval"],
    observability_control: ["observability", "monitoring"],
    clear_ownership: ["ownership", "accountability"],
    escalation: ["escalation", "human escalation"],
    data_boundaries: ["data boundaries", "boundaries"],
  },
  industries: {
    financial_services: ["financial services", "finance"],
    banking: ["banking", "bank"],
    insurance: ["insurance"],
    wealth_management: ["wealth", "wealth management"],
    media: ["media", "broadcasting"],
    government: ["government", "public sector"],
    technology: ["technology", "tech"],
    creative_services: ["creative", "agency"],
    retail: ["retail", "e-commerce", "ecommerce"],
    spatial_computing: ["spatial computing", "spatial"],
  },
  proofs: {
    maybank_digital_sales_growth: ["maybank", "etiqa"],
    mediacorp_audience_growth: ["mediacorp"],
    erste_customer_scale: ["erste"],
    manulife_lean_ml_ux: ["manulife"],
    publicis_handoff_reduction: ["publicis", "leo burnett"],
    marketclue_financial_agents: ["marketclue"],
  },
};

const BROAD_CREDIBILITY_PATTERNS = [
  "what is joz strongest at",
  "what is joz's biggest achievement",
  "what is jozs biggest achievement",
  "what makes joz different",
  "why should we hire joz",
  "why hire joz",
  "why is joz relevant now",
  "why is joz relevant",
  "why joz now",
  "biggest achievement",
  "strongest at",
  "makes joz different",
];

const TECHNICAL_DEPTH_PATTERNS = [
  "deep skills",
  "deepest skills",
  "strongest skills",
  "strongest technical skills",
  "technical depth",
  "core capabilities",
  "technical skills",
  "ai skills",
  "engineering skills",
  "how technical is joz",
  "what can joz build",
  "ai stack",
  "technical stack",
  "rag",
  "agentic ai",
  "context engineering",
  "ai governance",
  "architecture",
  "retrieval",
  "embeddings",
  "knowledge graph",
  "knowledge graphs",
  "acl",
  "observability",
];

const BROAD_CREDIBILITY_SLUG_BOOSTS = {
  "business-need-enterprise-proof": 40,
  "skills-largest-enterprise-scale-proof": 38,
  "skills-quantified-business-outcomes": 34,
  "business-need-hero-value": 28,
  "business-need-why-hire-joz-now": 28,
  "skills-hero-agentic-ai": 12,
};

const RECRUITER_OPERATIONS_SLUG = "skills-recruiter-operational-facts";
const TECHNICAL_SKILL_SLUG_BOOSTS = {
  "skills-agentic-ai-architecture": 28,
  "skills-technical-platform-stack": 24,
  "skills-agentic-ai-ux-orchestration": 20,
  "skills-hero-agentic-ai": 16,
};

const RECRUITER_QUERY_PATTERNS = [
  "nationality",
  "eu status",
  "eu national",
  "citizenship",
  "work authorization",
  "work authorisation",
  "singapore status",
  /\bep\b/,
  /\bpep\b/,
  "location",
  "based",
  "availability",
  "start date",
  "notice period",
  "contact",
  "email",
  "phone",
  "reach joz",
  "years of experience",
  "how many years",
  "years in ai",
];

let ontologyCache = null;

function normalizeArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))].sort()
    : [];
}

function normalizeLaneAlias(value = "") {
  const lane = String(value || "").trim().toLowerCase();
  if (lane === "mindset") return "systems_mindset";
  return lane;
}

function normalizeVerification(value) {
  if (value && typeof value === "object") {
    return String(value.status || "").trim().toLowerCase() || "draft";
  }
  return String(value || "").trim().toLowerCase() || "draft";
}

function normalizeMetadata(metadata = {}) {
  const lane = normalizeLaneAlias(metadata.lane || metadata.normalized_lane || "");
  return {
    ...metadata,
    lane,
    normalized_lane: lane,
    verification_status: normalizeVerification(metadata.verification_status || metadata.verification),
    priority_label: String(metadata.priority_label || "standard").trim().toLowerCase() || "standard",
    impact_score: Number.isFinite(Number(metadata.impact_score)) ? Number(metadata.impact_score) : 0,
    problems: normalizeArray(metadata.problems),
    principles: normalizeArray(metadata.principles),
    capabilities: normalizeArray(metadata.capabilities),
    outcomes: normalizeArray(metadata.outcomes),
    governance: normalizeArray(metadata.governance),
    industries: normalizeArray(metadata.industries),
    proofs: normalizeArray(metadata.proofs),
    related_proofs: normalizeArray(metadata.related_proofs),
  };
}

function queryHasAny(clean, terms = []) {
  return terms.some((term) => clean.includes(term));
}

function scoreQueryRelevance(doc, query = "") {
  const clean = String(query || "").trim().toLowerCase();
  if (!clean) return 0;

  const tokens = [...new Set(clean.split(/[^a-z0-9]+/).filter((token) => token.length > 2))];
  const title = String(doc?.title || "").toLowerCase();
  const slug = String(doc?.slug || "").toLowerCase();
  const summary = String(doc?.summary || "").toLowerCase();
  const category = String(doc?.category || "").toLowerCase();
  const tags = (doc?.metadata?.tags || []).join(" ").toLowerCase();

  let score = 0;

  for (const token of tokens) {
    if (title.includes(token)) score += 5;
    if (slug.includes(token)) score += 4;
    if (summary.includes(token)) score += 2;
    if (category.includes(token)) score += 1;
    if (tags.includes(token)) score += 1;
  }

  if (clean.includes("why should we hire") || clean.includes("why hire")) {
    if (title.includes("hire")) score += 8;
  }
  if (clean.includes("roi") && (title.includes("roi") || slug.includes("roi"))) {
    score += 8;
  }
  if ((clean.includes("enterprise") || clean.includes("achievement") || clean.includes("scale")) &&
      (title.includes("enterprise") || title.includes("scale") || slug.includes("enterprise"))) {
    score += 6;
  }
  if (clean.includes("biggest") && title.includes("largest")) {
    score += 8;
  }
  if (clean.includes("autonomy") && (title.includes("judgment") || summary.includes("autonomy"))) {
    score += 8;
  }

  return score;
}

function isBroadCredibilityQuery(query = "") {
  const clean = String(query || "").trim().toLowerCase();
  if (!clean) return false;
  return BROAD_CREDIBILITY_PATTERNS.some((pattern) => clean.includes(pattern));
}

function isTechnicalDepthQuery(query = "") {
  const clean = String(query || "").trim().toLowerCase();
  if (!clean) return false;
  return TECHNICAL_DEPTH_PATTERNS.some((pattern) => clean.includes(pattern));
}

function isRecruiterOperationalQuery(query = "") {
  const clean = String(query || "").trim().toLowerCase();
  if (!clean) return false;
  return RECRUITER_QUERY_PATTERNS.some((pattern) =>
    pattern instanceof RegExp ? pattern.test(clean) : clean.includes(pattern)
  );
}

function scoreBroadCredibility(doc, metadata, query = "") {
  if (!isBroadCredibilityQuery(query)) return 0;

  const slug = String(doc?.slug || "").trim();
  const relatedProofs = metadata.related_proofs.length ? metadata.related_proofs : metadata.proofs;
  let score = 0;

  score += BROAD_CREDIBILITY_SLUG_BOOSTS[slug] || 0;

  if (metadata.normalized_lane === "business_need") score += 10;
  if (slug === "business-need-enterprise-proof" || slug === "skills-largest-enterprise-scale-proof") score += 18;
  if (metadata.measurable_outcome_count >= 3) score += 12;
  if (Number(metadata.enterprise_scale_score || 0) >= 95) score += 16;
  if (relatedProofs.some((proofId) => [
    "maybank_digital_sales_growth",
    "mediacorp_audience_growth",
    "erste_customer_scale",
    "manulife_lean_ml_ux",
  ].includes(proofId))) {
    score += 15;
  }

  if (
    metadata.capabilities.length >= 5 &&
    metadata.proofs.length <= 1 &&
    metadata.measurable_outcome_count <= 1
  ) {
    score -= 18;
  }

  return score;
}

function scoreTechnicalDepth(doc, metadata, query = "") {
  if (!isTechnicalDepthQuery(query) || isBroadCredibilityQuery(query)) return 0;

  const slug = String(doc?.slug || "").trim();
  let score = 0;
  if (metadata.normalized_lane === "skills") score += 8;
  if (metadata.capabilities.length >= 4) score += 12;
  if (metadata.problems.length === 0 && metadata.capabilities.length >= 5) score += 4;
  score += TECHNICAL_SKILL_SLUG_BOOSTS[slug] || 0;
  return score;
}

function scoreCapabilityEligibility(doc, metadata, query = "") {
  const slug = String(doc?.slug || "").trim();
  const category = String(doc?.category || "").trim().toLowerCase();

  if (isTechnicalDepthQuery(query) && !isRecruiterOperationalQuery(query)) {
    if (slug === RECRUITER_OPERATIONS_SLUG) return -140;
    if (category === "recruiter_operations") return -120;
    if (TECHNICAL_SKILL_SLUG_BOOSTS[slug]) return TECHNICAL_SKILL_SLUG_BOOSTS[slug];
    if (metadata.normalized_lane === "skills" && metadata.capabilities.length >= 4) return 12;
  }

  if (isRecruiterOperationalQuery(query) && slug === RECRUITER_OPERATIONS_SLUG) {
    return 40;
  }

  return 0;
}

export function loadPublishedJozOntology() {
  if (ontologyCache) return ontologyCache;
  if (!fs.existsSync(publishedOntologyPath)) {
    ontologyCache = {
      problems: [],
      principles: [],
      capabilities: [],
      outcomes: [],
      governance: [],
      industries: [],
      proofs: [],
    };
    return ontologyCache;
  }

  ontologyCache = JSON.parse(fs.readFileSync(publishedOntologyPath, "utf8"));
  return ontologyCache;
}

export function mapJozQueryToOntology(query = "") {
  const clean = String(query || "").trim().toLowerCase();
  const matches = {
    problems: [],
    principles: [],
    capabilities: [],
    outcomes: [],
    governance: [],
    industries: [],
    proofs: [],
  };

  if (!clean) return matches;

  for (const [field, fieldMap] of Object.entries(FIELD_KEYWORDS)) {
    for (const [id, terms] of Object.entries(fieldMap)) {
      if (queryHasAny(clean, terms)) matches[field].push(id);
    }
    matches[field] = [...new Set(matches[field])].sort();
  }

  return matches;
}

export function computeJozDocumentRankingData(doc, { intentMode = "skills", query = "", ontology } = {}) {
  const metadata = normalizeMetadata(doc?.metadata || {});
  const primaryLane = normalizeLaneAlias(intentMode);
  const queryOntology = ontology || mapJozQueryToOntology(query);
  const relatedProofs = metadata.related_proofs.length ? metadata.related_proofs : metadata.proofs;

  let ontologyScore = 0;
  let proofScore = 0;

  for (const [field, weight] of Object.entries(QUERY_FIELD_WEIGHTS)) {
    const requested = queryOntology[field] || [];
    const available = field === "proofs" ? relatedProofs : metadata[field] || [];
    const overlap = requested.filter((id) => available.includes(id)).length;
    if (!overlap) continue;
    if (field === "proofs") {
      proofScore += overlap * weight;
    } else {
      ontologyScore += overlap * weight;
    }
  }

  const enterpriseScaleScore = Math.max(
    Number(metadata.enterprise_scale_score || 0),
    Number(metadata.impact_score || 0) >= 95 ? 1 : 0
  );
  const measurableOutcomeCount = (metadata.outcomes || []).filter((id) =>
    ["revenue_growth", "higher_adoption", "faster_decisions", "cost_reduction", "productivity_gains", "faster_time_to_value", "lower_risk"].includes(id)
  ).length;

  return {
    laneRank:
      metadata.normalized_lane === primaryLane
        ? 0
        : doc?.category === primaryLane
          ? 1
          : 2,
    queryRelevanceScore: scoreQueryRelevance({ ...doc, metadata }, query),
    broadCredibilityScore: scoreBroadCredibility(doc, metadata, query),
    technicalDepthScore: scoreTechnicalDepth(doc, metadata, query),
    capabilityEligibilityScore: scoreCapabilityEligibility(doc, metadata, query),
    verificationScore: VERIFICATION_WEIGHTS[metadata.verification_status] ?? 0,
    impactScore: metadata.impact_score,
    priorityScore: PRIORITY_WEIGHTS[metadata.priority_label] ?? 0,
    enterpriseScaleScore,
    ontologyScore,
    proofScore,
    measurableOutcomeCount,
    recencyKey: String(metadata.reviewed_at || metadata.source_filename || ""),
    metadata,
  };
}

export function compareJozDocumentRanking(a, b) {
  return (
    a.laneRank - b.laneRank ||
    b.broadCredibilityScore - a.broadCredibilityScore ||
    b.capabilityEligibilityScore - a.capabilityEligibilityScore ||
    b.queryRelevanceScore - a.queryRelevanceScore ||
    b.technicalDepthScore - a.technicalDepthScore ||
    b.verificationScore - a.verificationScore ||
    b.impactScore - a.impactScore ||
    b.priorityScore - a.priorityScore ||
    b.enterpriseScaleScore - a.enterpriseScaleScore ||
    b.ontologyScore - a.ontologyScore ||
    b.proofScore - a.proofScore ||
    b.measurableOutcomeCount - a.measurableOutcomeCount ||
    b.recencyKey.localeCompare(a.recencyKey)
  );
}

export function rankJozDocumentsForQuery(documents = [], { intentMode = "skills", query = "", limit = 8 } = {}) {
  const queryOntology = mapJozQueryToOntology(query);
  return documents
    .map((doc) => ({
      ...doc,
      metadata: normalizeMetadata(doc.metadata || {}),
      _ranking: computeJozDocumentRankingData(doc, {
        intentMode,
        query,
        ontology: queryOntology,
      }),
    }))
    .sort((left, right) => compareJozDocumentRanking(left._ranking, right._ranking))
    .slice(0, limit);
}
