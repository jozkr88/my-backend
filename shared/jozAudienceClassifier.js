const PERSONAS = [
  ["business_owner", "Business owner", [/\bmy (?:business|company|firm)\b/, /business owner/, /revenue|margin|profit|operating costs|\broi\b/]],
  ["recruiter", "Recruiter", [/\brecruit(?:er|ing|ment)\b/, /talent acquisition/, /candidate pipeline/, /job description/, /interview process/]],
  ["ai_specialist", "AI specialist", [/\b(?:llm|rag|embedding|vector database)\b/, /multi[- ]agent/, /agentic ai/, /prompt engineering/, /orchestration/, /inference/]],
  ["hiring_manager", "Hiring manager", [/\bhiring manager\b/, /my team is hiring/, /headcount/, /build (?:my|our) team/, /hire (?:an|a|for)/]],
  ["random_visitor", "Random visitor", []],
];

const KNOWLEDGE_LEVELS = [
  ["curious", "Curious", []],
  ["business_aware", "Business-aware", [/business value|business outcome|revenue|margin|cost|roi|customer/, /operational|process|efficiency|decision support/, /ai strategy|ai roadmap|ai readiness/]],
  ["practitioner", "Practitioner", [/implement|deploy|production|api|workflow automation/, /data pipeline|machine learning|computer vision|forecasting/, /integrat(?:e|ion)|monitoring|security controls/]],
  ["ai_specialist", "AI specialist", [/\b(?:llm|rag|embedding|vector database)\b/, /multi[- ]agent/, /agentic ai/, /model evaluation/, /prompt engineering/, /orchestration|inference|context engineering/]],
  ["ai_architect", "AI architect", [/ai operating model/, /governance architecture/, /agentic architecture/, /multi[- ]agent system/, /organisational awareness/, /autonomous execution/, /human[- ]in[- ]the[- ]loop/]],
];

function normalize(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function scored(text, definitions) {
  return definitions.map(([id, label, patterns]) => ({
    id,
    label,
    score: patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0),
  }));
}

function choose(scores, fallbackId, kind) {
  const ranked = [...scores].sort((left, right) => right.score - left.score);
  const best = ranked[0];
  const second = ranked[1]?.score || 0;
  const selected = best?.score ? best : scores.find((item) => item.id === fallbackId);
  const confidence = !best?.score
    ? kind === "persona" ? 0.28 : 0.25
    : best.score >= 2 && best.score > second ? 0.9
      : best.score > second ? 0.78
        : 0.58;
  return { id: selected.id, label: selected.label, confidence };
}

export function classifyJozAudience({ input = "", recentMessages = [], messages = [] } = {}) {
  const history = [...(Array.isArray(recentMessages) ? recentMessages : []), ...(Array.isArray(messages) ? messages : [])]
    .filter((message) => message?.role !== "assistant")
    .slice(-4)
    .map((message) => message?.content)
    .filter(Boolean);
  const text = normalize([input, ...history].join(" "));
  const personaScores = scored(text, PERSONAS);
  const knowledgeScores = scored(text, KNOWLEDGE_LEVELS);
  const persona = choose(personaScores, "random_visitor", "persona");
  const aiKnowledge = choose(knowledgeScores, "curious", "knowledge");

  return {
    version: 1,
    source: "deterministic_conversation_classifier",
    audienceAgents: personaScores.map((agent) => ({ ...agent, selected: agent.id === persona.id })),
    persona,
    aiKnowledge,
    analyzedMessageCount: 1 + (Array.isArray(recentMessages) ? recentMessages.length : 0) + (Array.isArray(messages) ? messages.length : 0),
  };
}
