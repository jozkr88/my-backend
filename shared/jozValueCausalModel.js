function cleanText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

const JOZ_VALUE_PATHWAYS = [
  {
    id: "agentic_ai_architecture",
    label: "Agentic AI architecture",
    terms: ["agentic ai", "agentic architecture", "ai architecture", "rag", "context engineering", "ai agents"],
    method: "connects context, retrieval, orchestration, verification, and governed tool use into an operating system",
    value: "turn fragmented knowledge and AI experiments into trusted decision support and usable execution",
    evidence: "Agentic AI architecture, MC USA financial agents, and the quantified outcomes corpus",
    evidenceTier: "supported_claim",
    sourceSlugs: ["skills-agentic-ai-architecture", "skills-quantified-business-outcomes", "business-need-why-hire-joz-now"],
  },
  {
    id: "systems_decision_intelligence",
    label: "Systems and decision intelligence",
    terms: ["systems thinking", "systems mindset", "decision intelligence", "decision quality", "operating model", "causal intelligence"],
    method: "maps business priorities, constraints, evidence, feedback loops, and accountable decisions across the whole system",
    value: "improves prioritisation and execution by making dependencies, ownership, risk, and measurable outcomes visible",
    evidence: "Systems decision thinking, decision-intelligence, and enterprise operating-model records",
    evidenceTier: "capability_supported",
    sourceSlugs: ["systems-decision-thinking", "business-need-decision-intelligence", "business-need-operating-model-blueprint"],
  },
  {
    id: "human_centered_spatial_ai",
    label: "Human-centred and spatial AI",
    terms: ["spatial intelligence", "spatial ai", "spatial computing", "3d", "xr", "ar", "immersive", "ux orchestration"],
    method: "uses interaction design, multimodal signals, and spatial interfaces to make complex intelligence understandable and actionable",
    value: "increase adoption and decision confidence by fitting AI into real human workflows rather than forcing people to adapt to the model",
    evidence: "Spatial 3D/XR/AR platform work and Agentic AI UX Orchestration",
    evidenceTier: "capability_supported",
    sourceSlugs: ["skills-spatial-3d-xr-ar-platforms", "skills-agentic-ai-ux-orchestration"],
  },
  {
    id: "causal_decision_architecture",
    label: "Causal decision architecture",
    terms: ["causal ai", "causal intelligence", "causal inference", "counterfactual", "intervention", "world model"],
    method: "keeps the knowledge graph, causal model, evidence, assumptions, and model versions connected but distinct",
    value: "creates a safer path from observation to intervention by separating what is known, what is hypothesised, and what must be validated",
    evidence: "Causal Intelligence AI Architecture and Causal Decision Operating System records",
    evidenceTier: "framework_guidance",
    sourceSlugs: ["2026-08-06-causal-intelligence-ai-architecture", "2026-08-06-causal-decision-operating-system"],
  },
];

const JOZ_SUBJECT_PATTERN = /\b(?:joz|joz's|jozs|his skills|his experience|his capability|hire joz)\b/i;
const VALUE_PATTERN = /\b(?:business value|value|benefit|impact|outcome|roi|commercial|helps?|create|creates|contribute|contribution|advantage|worth|useful)\b/i;

function hasTerm(text = "", term = "") {
  const escaped = String(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

export function getJozValueCausalPathways() {
  return JOZ_VALUE_PATHWAYS.map((pathway) => ({
    ...pathway,
    terms: [...pathway.terms],
    sourceSlugs: [...pathway.sourceSlugs],
  }));
}

export function matchJozValueCausalPathways(input = "") {
  const text = cleanText(input).toLowerCase();
  const matches = JOZ_VALUE_PATHWAYS.filter((pathway) =>
    pathway.terms.some((term) => hasTerm(text, term))
  );
  return matches.length ? matches : JOZ_VALUE_PATHWAYS.slice(0, 3);
}

export function isJozValueCausalQuestion(input = "") {
  const text = cleanText(input);
  if (!text || !VALUE_PATTERN.test(text)) return false;
  const hasJozSubject = JOZ_SUBJECT_PATTERN.test(text);
  const hasPathwayTerm = JOZ_VALUE_PATHWAYS.some((pathway) =>
    pathway.terms.some((term) => hasTerm(text, term))
  );
  return hasJozSubject || hasPathwayTerm;
}

function evidenceLabel(evidenceTier = "") {
  if (evidenceTier === "framework_guidance") return "framework guidance, not personal production proof";
  if (evidenceTier === "supported_claim") return "supported by Joz's skills and project evidence";
  return "capability-supported positioning, not a guaranteed financial result";
}

export function buildJozValueCausalReply({ input = "" } = {}) {
  const pathways = matchJozValueCausalPathways(input).slice(0, 3);
  const pathwayText = pathways
    .map((pathway) => `${pathway.label}: ${pathway.method}; this creates value by ${pathway.value}. Evidence: ${pathway.evidence} (${evidenceLabel(pathway.evidenceTier)}).`)
    .join(" ");

  return {
    reply: `For Joz, the strongest explanation is a value pathway rather than an unsupported causal or ROI claim: skill → method → evidence → business outcome. ${pathwayText} The pathway explains how Joz can create business value; the actual effect still depends on the organisation's baseline, intervention, constraints, and measured outcomes.`,
    answerSource: "joz_value_causal_model",
    composer: "buildJozValueCausalReply",
    fallbackUsed: false,
    intentMode: "skills",
    retrievedCategories: ["skills", "business_need", "causal_ai"],
    answerClass: "joz_value_pathway",
    confidence: "high",
    causalValue: {
      modelVersion: "joz-value-pathways-v1",
      pathwayIds: pathways.map((pathway) => pathway.id),
      evidenceTiers: pathways.map((pathway) => pathway.evidenceTier),
      sourceSlugs: [...new Set(pathways.flatMap((pathway) => pathway.sourceSlugs))],
      claimBoundary: "value_pathway_not_empirical_effect",
    },
  };
}
