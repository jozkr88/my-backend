const PERSONA_DEFINITIONS = [
  { id: "business_owner", label: "Business owner" },
  { id: "recruiter", label: "Recruiter" },
  { id: "ai_specialist", label: "AI specialist" },
  { id: "hiring_manager", label: "Hiring manager" },
  { id: "random_visitor", label: "Random visitor" },
];

const KNOWLEDGE_DEFINITIONS = [
  { id: "curious", label: "Curious" },
  { id: "business_aware", label: "Business-aware" },
  { id: "practitioner", label: "Practitioner" },
  { id: "ai_specialist", label: "AI specialist" },
  { id: "ai_architect", label: "AI architect" },
];

const PERSONA_RULES = [
  {
    id: "recruiter",
    patterns: [
      /\brecruit(?:er|ing|ment)\b/,
      /talent acquisition/,
      /sourcing candidates/,
      /candidate pipeline/,
      /job description/,
      /interview process/,
    ],
  },
  {
    id: "hiring_manager",
    patterns: [
      /\bhiring manager\b/,
      /my team is hiring/,
      /hire (?:an|a|for)/,
      /what skills should we hire/,
      /headcount/,
      /build (?:my|our) team/,
    ],
  },
  {
    id: "ai_specialist",
    patterns: [
      /\b(?:llm|rag|retrieval augmented|fine[- ]?tun(?:e|ing)|embedding|vector database)\b/,
      /multi[- ]agent/,
      /agentic ai/,
      /model evaluation/,
      /prompt engineering/,
      /orchestration/,
      /inference/,
      /context engineering/,
    ],
  },
  {
    id: "business_owner",
    patterns: [
      /\b(?:my|our) (?:business|company|firm|shop|startup)/,
      /business owner/,
      /revenue|margin|profit|customers|operating costs/,
      /how can joz help (?:my|our) /,
      /return on investment|\broi\b/,
      /business problem/,
    ],
  },
];

const KNOWLEDGE_RULES = [
  {
    id: "ai_architect",
    patterns: [
      /ai operating model/,
      /governance architecture/,
      /agentic architecture/,
      /multi[- ]agent system/,
      /organisational awareness/,
      /autonomous execution/,
      /human[- ]in[- ]the[- ]loop/,
    ],
  },
  {
    id: "ai_specialist",
    patterns: [
      /\b(?:llm|rag|retrieval augmented|fine[- ]?tun(?:e|ing)|embedding|vector database)\b/,
      /multi[- ]agent/,
      /agentic ai/,
      /model evaluation/,
      /prompt engineering/,
      /orchestration|inference|context engineering/,
    ],
  },
  {
    id: "practitioner",
    patterns: [
      /implement|deploy|production|api|workflow automation/,
      /data pipeline|machine learning|computer vision|forecasting/,
      /integrat(?:e|ion)|monitoring|security controls/,
    ],
  },
  {
    id: "business_aware",
    patterns: [
      /business value|business outcome|revenue|margin|cost|roi|customer/,
      /operational|process|efficiency|decision support/,
      /ai strategy|ai roadmap|ai readiness/,
    ],
  },
];

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function scoreRules(text, rules) {
  return rules
    .map((rule) => ({
      id: rule.id,
      score: rule.patterns.reduce(
        (total, pattern) => total + (pattern.test(text) ? 1 : 0),
        0
      ),
    }))
    .sort((left, right) => right.score - left.score);
}

function confidenceFor(score, secondScore, kind) {
  if (!score) return kind === "persona" ? 0.28 : 0.25;
  if (score >= 2 && score > secondScore) return 0.9;
  if (score > secondScore) return 0.78;
  return 0.58;
}

function chooseProfile(text, rules, definitions, fallbackId, kind) {
  const scores = scoreRules(text, rules);
  const best = scores[0];
  const secondScore = scores[1]?.score || 0;
  const chosenId = best?.score ? best.id : fallbackId;
  const definition = definitions.find((item) => item.id === chosenId);
  const matched = rules.find((rule) => rule.id === chosenId);
  const evidence = matched
    ? matched.patterns
        .filter((pattern) => pattern.test(text))
        .map((pattern) => pattern.source.replaceAll("\\b", "").replaceAll("\\", ""))
        .slice(0, 3)
    : [];

  return {
    id: chosenId,
    label: definition?.label || chosenId,
    confidence: confidenceFor(best?.score || 0, secondScore, kind),
    evidence,
  };
}

function collectConversationText({ input = "", recentMessages = [], messages = [] } = {}) {
  const history = [...(Array.isArray(recentMessages) ? recentMessages : []), ...(Array.isArray(messages) ? messages : [])];
  const recentUserText = history
    .filter((message) => message?.role !== "assistant")
    .slice(-4)
    .map((message) => message?.content)
    .filter(Boolean);
  return normalizeText([input, ...recentUserText].join(" "));
}

export function classifyJozAudience({ input = "", recentMessages = [], messages = [] } = {}) {
  const text = collectConversationText({ input, recentMessages, messages });
  const persona = chooseProfile(text, PERSONA_RULES, PERSONA_DEFINITIONS, "random_visitor", "persona");
  const knowledge = chooseProfile(text, KNOWLEDGE_RULES, KNOWLEDGE_DEFINITIONS, "curious", "knowledge");
  const personaScores = scoreRules(text, PERSONA_RULES);

  return {
    version: 1,
    source: "deterministic_conversation_classifier",
    // Five cheap, explainable detectors replace opaque LLM calls for this
    // analytics layer. They never participate in answer generation.
    audienceAgents: PERSONA_DEFINITIONS.map((definition) => {
      const score = personaScores.find((item) => item.id === definition.id)?.score || 0;
      return {
        id: definition.id,
        label: definition.label,
        score,
        selected: definition.id === persona.id,
      };
    }),
    persona,
    aiKnowledge: knowledge,
    analyzedMessageCount: 1 + (Array.isArray(recentMessages) ? recentMessages.length : 0) + (Array.isArray(messages) ? messages.length : 0),
  };
}

export const JOZ_AUDIENCE_PERSONAS = PERSONA_DEFINITIONS;
export const JOZ_AI_KNOWLEDGE_LEVELS = KNOWLEDGE_DEFINITIONS;
