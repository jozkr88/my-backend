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
    healthcare: ["healthcare", "health", "medtech", "medical", "pharma", "pharmaceutical"],
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
  "what is joz's biggest enterprise achievement",
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

const BUSINESS_VALUE_QUERY_FAMILIES = {
  efficiency: [
    "efficiency",
    "lower cost",
    "cost reduction",
    "faster execution",
    "operational leverage",
    "productivity gains",
  ],
  processes: [
    "processes",
    "process redesign",
    "workflow redesign",
    "process improvement",
    "workflow",
  ],
  growth: [
    "growth",
    "scaling",
    "scale",
    "commercial performance",
    "revenue growth",
  ],
  functions: [
    "functions",
    "finance",
    "erp",
    "accounting",
    "hr",
    "marketing",
    "operations",
  ],
  operating_model: [
    "operating model",
    "ownership",
    "governance",
    "execution",
  ],
  decision_support: [
    "decision support",
    "better signal",
    "prioritization",
    "prioritisation",
    "judgment",
    "clarity",
  ],
};

const BUSINESS_VALUE_FAMILY_PRIORITY = [
  "decision_support",
  "functions",
  "operating_model",
  "efficiency",
  "growth",
  "processes",
];

const BUSINESS_VALUE_SLUG_BOOSTS = {
  efficiency: {
    "business-need-efficiency-vs-growth": 42,
    "business-need-profit-levers": 30,
    "business-need-process-redesign-framework": 18,
    "business-need-hero-value": 12,
  },
  processes: {
    "business-need-process-redesign-framework": 42,
    "business-need-erp-finance-hr-marketing-opportunity-map": 26,
    "business-need-operating-model-blueprint": 18,
  },
  growth: {
    "business-need-efficiency-vs-growth": 38,
    "business-need-profit-levers": 24,
    "business-need-department-profit-use-cases": 20,
    "business-need-hero-value": 14,
  },
  functions: {
    "business-need-ai-by-function": 42,
    "business-need-erp-finance-hr-marketing-opportunity-map": 30,
    "business-need-department-profit-use-cases": 20,
  },
  operating_model: {
    "business-need-operating-model-blueprint": 44,
    "business-need-ai-adoption-governance": 24,
    "business-need-process-redesign-framework": 18,
  },
  decision_support: {
    "business-need-decision-intelligence": 42,
    "business-need-hero-value": 18,
    "business-need-operating-model-blueprint": 14,
  },
};

const BUSINESS_VALUE_DEMOTIONS = new Set([
  "business-need-architecture-scalability",
  "business-need-current-data-architecture",
  "business-need-dataset-extension-framework",
  "business-need-why-joz-is-irreplaceable",
]);

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
    projects: normalizeArray(metadata.projects),
    intent_families: normalizeArray(metadata.intent_families),
    sub_intents: normalizeArray(metadata.sub_intents),
    keyword_terms: normalizeArray(metadata.keyword_terms),
    exact_phrases: normalizeArray(metadata.exact_phrases),
    canonical_record_tags: normalizeArray(metadata.canonical_record_tags),
    source_authority: Number.isFinite(Number(metadata.source_authority))
      ? Number(metadata.source_authority)
      : 0,
    canonical_record: Boolean(metadata.canonical_record),
    semantic_text: String(metadata.semantic_text || "").trim(),
  };
}

function tokenizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

function buildHashedEmbedding(text = "", dimensions = 128) {
  const vector = new Array(dimensions).fill(0);
  const tokens = tokenizeText(text);

  for (const token of tokens) {
    let hash = 0;
    for (let index = 0; index < token.length; index += 1) {
      hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
    }
    const bucket = hash % dimensions;
    vector[bucket] += 1 + Math.min(token.length, 8) / 10;
  }

  return vector;
}

function cosineSimilarity(left = [], right = []) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] || 0;
    const rightValue = right[index] || 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (!leftMagnitude || !rightMagnitude) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function queryHasAny(clean, terms = []) {
  return terms.some((term) => clean.includes(term));
}

function scoreExactMetadataPhraseMatches(clean = "", values = [], weight = 0) {
  return values.reduce((score, value) => {
    const phrase = String(value || "").trim().toLowerCase();
    if (!phrase) return score;
    return clean.includes(phrase) ? score + weight : score;
  }, 0);
}

function scoreExactPhraseMatches(clean = "", doc = {}) {
  const title = String(doc?.title || "").trim().toLowerCase();
  const phrases = normalizeArray([
    title,
    ...(doc?.metadata?.exact_phrases || []),
    ...(doc?.metadata?.tags || []),
    ...(doc?.metadata?.canonical_record_tags || []),
  ]);

  return phrases.reduce((score, phrase) => {
    if (!phrase) return score;
    if (clean === phrase) return score + 32;
    if (clean.includes(phrase)) return score + 18;
    return score;
  }, 0);
}

function scoreTagMatches(clean = "", doc = {}) {
  const tags = normalizeArray([
    ...(doc?.metadata?.tags || []),
    ...(doc?.metadata?.canonical_record_tags || []),
  ]);
  if (!tags.length || !clean) return 0;
  return tags.reduce((score, tag) => (clean.includes(tag.toLowerCase()) ? score + 8 : score), 0);
}

function scoreSemanticSimilarity(query = "", doc = {}) {
  const semanticText = String(doc?.metadata?.semantic_text || "").trim();
  if (!query || !semanticText) return 0;
  const queryVector = buildHashedEmbedding(query);
  const docVector = buildHashedEmbedding(semanticText);
  return Math.round(cosineSimilarity(queryVector, docVector) * 100);
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
  const companiesList = Array.isArray(doc?.metadata?.companies) ? doc.metadata.companies : [];
  const projectsList = Array.isArray(doc?.metadata?.projects) ? doc.metadata.projects : [];
  const companies = (doc?.metadata?.companies || []).join(" ").toLowerCase();
  const projects = (doc?.metadata?.projects || []).join(" ").toLowerCase();
  const subIntents = (doc?.metadata?.sub_intents || []).join(" ").toLowerCase();
  const intentFamilies = (doc?.metadata?.intent_families || []).join(" ").toLowerCase();
  const body = String(doc?.body || "").toLowerCase();

  let score = 0;

  for (const token of tokens) {
    if (title.includes(token)) score += 5;
    if (slug.includes(token)) score += 4;
    if (summary.includes(token)) score += 2;
    if (category.includes(token)) score += 1;
    if (tags.includes(token)) score += 1;
    if (companies.includes(token)) score += 6;
    if (projects.includes(token)) score += 7;
    if (subIntents.includes(token)) score += 2;
    if (intentFamilies.includes(token)) score += 1;
    if (body.includes(token)) score += 1;
  }

  if (companies && tokens.some((token) => companies.includes(token))) score += 10;
  if (projects && tokens.some((token) => projects.includes(token))) score += 12;
  score += scoreExactMetadataPhraseMatches(clean, companiesList, 22);
  score += scoreExactMetadataPhraseMatches(clean, projectsList, 18);

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
  if (
    category === "bio" &&
    (clean.includes("biggest") || clean.includes("achievement")) &&
    (clean.includes("enterprise") || clean.includes("scale") || clean.includes("strongest"))
  ) {
    score -= 18;
  }
  if (clean.includes("autonomy") && (title.includes("judgment") || summary.includes("autonomy"))) {
    score += 8;
  }
  if (
    (clean.includes("complex systems") || clean.includes("how does joz think")) &&
    title.includes("systems mindset")
  ) {
    score += 40;
  }
  if (clean.includes("what did joz do at") || clean.includes("what projects did joz do at")) {
    if (companies && tokens.some((token) => companies.includes(token))) score += 18;
    if (projects && tokens.some((token) => projects.includes(token))) score += 10;
    score += scoreExactMetadataPhraseMatches(clean, companiesList, 26);
  }
  if (clean.includes("private banking") && (summary.includes("private banking") || projects.includes("private banking") || body.includes("private banking"))) {
    score += 14;
  }
  if (clean.includes("cms") && (projects.includes("cms") || body.includes("cms"))) {
    score += 8;
  }
  if (clean.includes("apple watch") && (projects.includes("apple watch") || body.includes("apple watch"))) {
    score += 10;
  }
  if (clean.includes("healthcare") && (summary.includes("healthcare") || (doc?.metadata?.industries || []).includes("healthcare"))) {
    score += 14;
  }

  if (clean.includes("prompt injection") && title.includes("prompt injection")) score += 1000;
  if (
    (clean.includes("permissions") || clean.includes("acl") || clean.includes("before retrieval")) &&
    (title.includes("acl-aware retrieval") || title.includes("acl aware retrieval"))
  ) {
    score += 1000;
  }
  if (clean.includes("knowledge graph") && title.includes("organisational knowledge layer")) {
    score += 1000;
  } else if (clean.includes("knowledge graph") && (title.includes("knowledge layer") || body.includes("knowledge graph"))) {
    score += 260;
  }
  if (clean.includes("organisational awareness layer") || clean.includes("organizational awareness layer")) {
    if (title.includes("organisational awareness layer")) score += 1000;
  }
  if (clean.includes("autonomous execution layer")) {
    if (title.includes("autonomous execution layer")) score += 1000;
  }
  if (
    (clean.includes("verify autonomous code changes") || clean.includes("verification fails")) &&
    title.includes("autonomous code verification")
  ) {
    score += 1000;
  }
  if (
    (clean.includes("deploy directly to production") ||
      clean.includes("human approval") ||
      clean.includes("high-risk actions") ||
      clean.includes("high risk actions")) &&
    title.includes("execution guardrails")
  ) {
    score += 220;
  }
  if ((clean.includes("langgraph") || clean.includes("temporal")) && title === "orchestration") {
    score += 220;
  }
  if (clean.includes("what is docker") && title === "docker") score += 1000;
  if (clean.includes("what is kubernetes") && title === "kubernetes") score += 1000;
  if (clean.includes("difference between docker and kubernetes") && title === "kubernetes") {
    score += 1000;
  }
  if (clean.includes("what is a kubernetes pod") && title === "kubernetes pods") score += 1000;
  if (clean.includes("what is a kubernetes deployment") && title === "kubernetes deployment") {
    score += 1000;
  }
  if (clean.includes("what is a kubernetes service") && title === "kubernetes service") {
    score += 1000;
  }
  if (clean.includes("what is ingress") && title === "ingress and api gateway") score += 1000;
  if (clean.includes("load balancer") && title === "load balancer") score += 1000;
  if (clean.includes("horizontal scaling") && title === "horizontal and vertical scaling") {
    score += 1000;
  }
  if (clean.includes("autoscaling") && title === "autoscaling") score += 1000;
  if (clean.includes("stateless") && title === "stateless services") score += 1000;
  if (clean.includes("what is postgresql") && title === "postgresql") score += 1000;
  if (clean.includes("what is redis") && title === "redis") score += 1000;
  if (clean.includes("difference between postgresql and redis") && title === "redis") {
    score += 1000;
  }
  if (clean.includes("what is kafka") && title === "kafka and nats") score += 1000;
  if (clean.includes("kafka versus nats") && title === "kafka and nats") score += 1000;
  if (clean.includes("event-driven architecture") && title === "event-driven architecture") {
    score += 1000;
  }
  if (clean.includes("what is temporal used for") && title === "temporal") score += 1000;
  if (clean.includes("workload identity") && title === "workload identity") score += 1000;
  if ((clean.includes("what is vault") || clean.includes("what is kms")) && title === "secrets management") {
    score += 1000;
  }
  if (clean.includes("what is opentelemetry") && title === "opentelemetry") score += 1000;
  if (clean.includes("difference between logs, metrics, and traces") && title === "observability") {
    score += 1000;
  }
  if (clean.includes("what is ci/cd") && title === "ci/cd") score += 1000;
  if (clean.includes("what is terraform") && title === "infrastructure as code") score += 1000;
  if (clean.includes("what is gitops") && title === "gitops") score += 1000;
  if (clean.includes("canary deployment") && title === "blue-green and canary deployment") {
    score += 1000;
  }
  if (clean.includes("circuit breaker") && title === "circuit breaker") score += 1000;
  if (clean.includes("idempotency") && title === "idempotency") score += 1000;
  if (clean.includes("backpressure") && title === "backpressure") score += 1000;
  if (clean.includes("disaster recovery") && title === "disaster recovery") score += 1000;
  if (
    (clean.includes("infrastructure philosophy") || clean.includes("approaches infrastructure")) &&
    title === "how joz approaches infrastructure"
  ) {
    score += 1000;
  }
  if (clean.includes("scale an agent platform") && title === "agent infrastructure scaling") {
    score += 1000;
  }
  if (clean.includes("fastapi") && title === "fastapi") score += 220;
  if (clean.includes("what is mcp") && title === "mcp") score += 220;
  if ((clean.includes("python") || clean.includes("golang")) && title.includes("golang and python")) {
    score += 220;
  }

  score += scoreTagMatches(clean, doc);
  score += scoreExactPhraseMatches(clean, doc);

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

function detectBusinessValueQueryFamily(query = "") {
  const clean = String(query || "").trim().toLowerCase();
  if (!clean) return null;

  const scores = BUSINESS_VALUE_FAMILY_PRIORITY.map((family) => {
    const patterns = BUSINESS_VALUE_QUERY_FAMILIES[family] || [];
    const matches = patterns.filter((pattern) => clean.includes(pattern)).length;
    return { family, score: matches };
  }).filter(({ score }) => score > 0);

  if (!scores.length) return null;

  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (
      BUSINESS_VALUE_FAMILY_PRIORITY.indexOf(a.family) -
      BUSINESS_VALUE_FAMILY_PRIORITY.indexOf(b.family)
    );
  });

  return scores[0].family;
}

function scoreBroadCredibility(doc, metadata, query = "") {
  if (!isBroadCredibilityQuery(query)) return 0;

  const slug = String(doc?.slug || "").trim();
  const category = String(doc?.category || "").trim().toLowerCase();
  const clean = String(query || "").trim().toLowerCase();
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

  // Keep identity/background records from outranking proof-led enterprise answers.
  if (
    category === "bio" &&
    (clean.includes("biggest") || clean.includes("achievement")) &&
    (clean.includes("enterprise") || clean.includes("scale") || clean.includes("strongest"))
  ) {
    score -= 24;
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
  const clean = String(query || "").trim().toLowerCase();

  if (isTechnicalDepthQuery(query) && !isRecruiterOperationalQuery(query)) {
    if (slug === RECRUITER_OPERATIONS_SLUG) return -140;
    if (category === "recruiter_operations") return -120;
    if (TECHNICAL_SKILL_SLUG_BOOSTS[slug]) return TECHNICAL_SKILL_SLUG_BOOSTS[slug];
    if (metadata.normalized_lane === "skills" && metadata.capabilities.length >= 4) return 12;
  }

  if (isRecruiterOperationalQuery(query) && slug === RECRUITER_OPERATIONS_SLUG) {
    return 40;
  }

  if (clean.includes("ai adoption") && slug === "skills-hero-agentic-ai") {
    return 28;
  }

  const businessValueFamily = detectBusinessValueQueryFamily(query);
  if (businessValueFamily && metadata.normalized_lane === "business_need") {
    let score = (BUSINESS_VALUE_SLUG_BOOSTS[businessValueFamily]?.[slug] || 0) * 2;

    if (BUSINESS_VALUE_DEMOTIONS.has(slug)) score -= 18;
    if (businessValueFamily === "functions" && slug === "business-need-enterprise-proof") score -= 16;
    if (businessValueFamily === "growth" && slug === "business-need-why-joz-is-irreplaceable") score -= 10;
    if (businessValueFamily === "functions" && slug === "business-need-process-redesign-framework") score -= 28;
    if (businessValueFamily === "decision_support" && slug === "business-need-ai-by-function") score -= 34;
    if (businessValueFamily === "decision_support" && slug === "business-need-erp-finance-hr-marketing-opportunity-map") score -= 18;
    return score;
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
    intentPrecisionScore: 0,
    broadCredibilityScore: scoreBroadCredibility(doc, metadata, query),
    technicalDepthScore: scoreTechnicalDepth(doc, metadata, query),
    capabilityEligibilityScore: scoreCapabilityEligibility(doc, metadata, query),
    semanticScore: scoreSemanticSimilarity(query, { ...doc, metadata }),
    exactPhraseScore: scoreExactPhraseMatches(String(query || "").trim().toLowerCase(), {
      ...doc,
      metadata,
    }),
    tagScore: scoreTagMatches(String(query || "").trim().toLowerCase(), { ...doc, metadata }),
    verificationScore: VERIFICATION_WEIGHTS[metadata.verification_status] ?? 0,
    impactScore: metadata.impact_score,
    priorityScore: PRIORITY_WEIGHTS[metadata.priority_label] ?? 0,
    sourceAuthorityScore: metadata.source_authority || 0,
    enterpriseScaleScore,
    ontologyScore,
    proofScore,
    measurableOutcomeCount,
    recencyKey: String(metadata.reviewed_at || metadata.source_filename || ""),
    metadata,
  };
}

function withIntentPrecision(ranking = {}) {
  return {
    ...ranking,
    intentPrecisionScore:
      Number(ranking.queryRelevanceScore || 0) >= 500 ? Number(ranking.queryRelevanceScore || 0) : 0,
  };
}

export function compareJozDocumentRanking(a, b) {
  return (
    a.laneRank - b.laneRank ||
    b.intentPrecisionScore - a.intentPrecisionScore ||
    b.broadCredibilityScore - a.broadCredibilityScore ||
    b.capabilityEligibilityScore - a.capabilityEligibilityScore ||
    b.technicalDepthScore - a.technicalDepthScore ||
    b.queryRelevanceScore - a.queryRelevanceScore ||
    b.exactPhraseScore - a.exactPhraseScore ||
    b.tagScore - a.tagScore ||
    b.semanticScore - a.semanticScore ||
    b.verificationScore - a.verificationScore ||
    b.impactScore - a.impactScore ||
    b.priorityScore - a.priorityScore ||
    b.sourceAuthorityScore - a.sourceAuthorityScore ||
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
      _ranking: withIntentPrecision(
        computeJozDocumentRankingData(doc, {
          intentMode,
          query,
          ontology: queryOntology,
        })
      ),
    }))
    .sort((left, right) => compareJozDocumentRanking(left._ranking, right._ranking))
    .slice(0, limit);
}
