const INTENT_KINDS = new Set([
  "answer",
  "navigate",
  "execute",
  "clarify",
  "refuse",
]);

const INTENT_DOMAINS = new Set([
  "joz_profile",
  "business",
  "agentic_ai",
  "systems_mindset",
  "world_navigation",
  "contact",
  "general_knowledge",
  "other",
]);

const NAVIGATION_PATTERN =
  /\b(open|enter|go to|go inside|show|launch|navigate|take me to|back|return|exit)\b/i;
const EXECUTION_PATTERN =
  /\b(send|email|call|book|schedule|create|delete|update|publish|deploy|merge|run|execute|buy|sell|transfer|change|submit)\b/i;
const HIGH_RISK_PATTERN =
  /\b(production|prod|deploy|merge|delete|destroy|transfer|payment|pay|buy|sell|private key|secret|credential|permission|security|database migration)\b/i;
const MEDIUM_RISK_PATTERN =
  /\b(send|email|call|book|schedule|publish|submit|contact|external|customer|user data)\b/i;

function normalizeText(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function clampConfidence(value, fallback = 0.35) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}

function confidenceBand(confidence) {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.55) return "medium";
  return "low";
}

function inferDomain(route = {}) {
  switch (route?.selectedRoute) {
    case "business_need":
      return "business";
    case "systems_mindset":
      return "systems_mindset";
    case "skills":
      return "agentic_ai";
    case "identity_profile":
    case "factual_profile":
    case "joz_knowledge":
      return "joz_profile";
    case "world_awareness":
    case "canonical_world_concept":
      return "world_navigation";
    default:
      return "other";
  }
}

function inferRisk({ input, kind }) {
  const clean = normalizeText(input);
  if (kind !== "execute") {
    return {
      level: "low",
      requiresApproval: false,
      reasons: [],
    };
  }

  if (HIGH_RISK_PATTERN.test(clean)) {
    return {
      level: "high",
      requiresApproval: true,
      reasons: ["The request may change production, sensitive data, money, or security state."],
    };
  }

  if (MEDIUM_RISK_PATTERN.test(clean)) {
    return {
      level: "medium",
      requiresApproval: true,
      reasons: ["The request may create an external communication or commitment."],
    };
  }

  return {
    level: "low",
    requiresApproval: false,
    reasons: [],
  };
}

export function buildJozIntentClassification({ input = "", route = {} } = {}) {
  const clean = normalizeText(input);
  const routeKnown = Boolean(route?.selectedRoute && route.selectedRoute !== "unknown_fallback");
  const routeDomain = inferDomain(route);
  const looksLikeNavigation = NAVIGATION_PATTERN.test(clean);
  const isQuestion = /^(what|why|how|who|when|where|which|can|could|would|should|do|does|is|are|tell|explain)\b/i.test(
    clean
  );
  const looksLikeExecution = EXECUTION_PATTERN.test(clean) && !isQuestion;
  const isAmbiguous =
    clean.length < 8 ||
    route?.detectedSubIntent === "ambiguous_follow_up" ||
    /^(it|that|this|there|more|why|how)\b/i.test(clean);

  let kind = "answer";
  let confidence = routeKnown ? 0.88 : 0.35;
  let domain = routeKnown ? routeDomain : "other";
  let goal = route?.detectedSubIntent || "answer_user_question";

  if (looksLikeExecution) {
    kind = "execute";
    confidence = routeKnown ? 0.82 : 0.62;
    domain = /\b(email|call|book|schedule|contact)\b/i.test(clean)
      ? "contact"
      : domain;
    goal = "perform_requested_action";
  } else if (looksLikeNavigation && routeDomain === "world_navigation") {
    kind = "navigate";
    confidence = 0.94;
    domain = "world_navigation";
    goal = "navigate_interactive_world";
  } else if (isAmbiguous && !routeKnown) {
    kind = "clarify";
    confidence = 0.86;
    goal = "clarify_missing_topic_or_action";
  } else if (!routeKnown) {
    domain = "general_knowledge";
    goal = "answer_open_ended_question";
  }

  const risk = inferRisk({ input: clean, kind });
  const normalizedConfidence = clampConfidence(confidence);

  return {
    version: "1",
    source: "deterministic",
    kind,
    domain,
    goal,
    entities: [],
    confidence: normalizedConfidence,
    confidenceBand: confidenceBand(normalizedConfidence),
    needsClarification: kind === "clarify",
    risk,
  };
}

function normalizeModelClassification(raw = {}, fallback = {}) {
  const kind = INTENT_KINDS.has(String(raw?.kind || "").trim().toLowerCase())
    ? String(raw.kind).trim().toLowerCase()
    : fallback.kind;
  const domain = INTENT_DOMAINS.has(String(raw?.domain || "").trim().toLowerCase())
    ? String(raw.domain).trim().toLowerCase()
    : fallback.domain;
  const confidence = clampConfidence(raw?.confidence, fallback.confidence);
  const fallbackRisk = fallback.risk || { level: "low", requiresApproval: false, reasons: [] };
  const modelRiskLevel = ["low", "medium", "high"].includes(raw?.risk?.level)
    ? raw.risk.level
    : fallbackRisk.level;
  const risk = {
    level:
      fallbackRisk.level === "high" || modelRiskLevel === "high"
        ? "high"
        : fallbackRisk.level === "medium" || modelRiskLevel === "medium"
          ? "medium"
          : "low",
    requiresApproval:
      Boolean(fallbackRisk.requiresApproval || raw?.risk?.requiresApproval),
    reasons: [
      ...(Array.isArray(fallbackRisk.reasons) ? fallbackRisk.reasons : []),
      ...(Array.isArray(raw?.risk?.reasons) ? raw.risk.reasons : []),
    ].filter(Boolean).slice(0, 4),
  };

  return {
    version: "1",
    source: "model",
    kind,
    domain,
    goal: normalizeText(raw?.goal) || fallback.goal,
    entities: Array.isArray(raw?.entities)
      ? raw.entities.map((entity) => normalizeText(entity)).filter(Boolean).slice(0, 8)
      : fallback.entities,
    confidence,
    confidenceBand: confidenceBand(confidence),
    needsClarification: kind === "clarify" || confidence < 0.55,
    risk,
  };
}

export function buildJozIntentClassifierPrompt() {
  return [
    "Classify the latest user message for Joz LLM.",
    "Return only JSON with keys: kind, domain, goal, entities, confidence, risk.",
    "kind must be answer, navigate, execute, clarify, or refuse.",
    "domain must be joz_profile, business, agentic_ai, systems_mindset, world_navigation, contact, general_knowledge, or other.",
    "Use answer for questions or explanations, navigate for app/world movement, execute for requested external or state-changing actions, clarify when the topic or requested action is missing, and refuse for unsafe or disallowed requests.",
    "Treat the UI lane as context only; classify the latest message independently.",
    "Risk must contain level (low, medium, high), requiresApproval (boolean), and reasons (array).",
    "High risk includes production changes, deletion, credentials, security, payments, transfers, private keys, or irreversible actions.",
    "Medium risk includes contacting people, sending messages, bookings, publishing, or submitting external changes.",
    "Confidence is a number from 0 to 1.",
  ].join(" ");
}

export async function classifyJozIntent({
  openai = null,
  input = "",
  messages = [],
  context = {},
  route = {},
} = {}) {
  const fallback = buildJozIntentClassification({ input, route });

  if (!openai || !process.env.OPENAI_API_KEY) return fallback;
  if (fallback.kind === "navigate" || fallback.kind === "execute") return fallback;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.JOZ_INTENT_MODEL || "gpt-4o-mini",
      temperature: 0,
      max_tokens: 220,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildJozIntentClassifierPrompt() },
        {
          role: "user",
          content: JSON.stringify({
            latestMessage: normalizeText(input),
            recentMessages: messages.slice(-6).map((message) => ({
              role: message?.role === "assistant" ? "assistant" : "user",
              content: normalizeText(message?.content),
            })),
            context: {
              currentPortal: context?.currentPortal || "root",
              currentMesh: context?.currentMesh || null,
              currentMeshStage: context?.currentMeshStage || null,
              laneHint: context?.intentMode || null,
            },
            deterministicHint: fallback,
          }),
        },
      ],
    });
    const content = response.choices?.[0]?.message?.content?.trim() || "{}";
    return normalizeModelClassification(JSON.parse(content), fallback);
  } catch (error) {
    console.error("⚠️ Joz intent classifier failed; using deterministic result:", error?.message || error);
    return fallback;
  }
}

export function buildJozAgentPlan({ classification = {} } = {}) {
  const kind = classification?.kind || "clarify";
  if (kind === "navigate") {
    return { stage: "agent", strategy: "validate_navigation_action", tools: ["world_navigation"] };
  }
  if (kind === "execute") {
    return { stage: "agent", strategy: "risk_check_then_execute", tools: ["approved_action"] };
  }
  if (kind === "refuse") {
    return { stage: "agent", strategy: "safe_refusal", tools: [] };
  }
  if (kind === "clarify" || classification?.needsClarification) {
    return { stage: "agent", strategy: "ask_clarifying_question", tools: [] };
  }
  return { stage: "agent", strategy: "retrieve_then_answer", tools: ["joz_knowledge"] };
}

export function buildJozRiskGateResolution({ classification = {} } = {}) {
  if (classification?.kind !== "execute" || !classification?.risk?.requiresApproval) {
    return null;
  }

  const riskLevel = classification.risk.level || "medium";
  const reasons = Array.isArray(classification.risk.reasons)
    ? classification.risk.reasons.filter(Boolean).slice(0, 2).join(" ")
    : "The requested action changes state or affects an external party.";

  return {
    reply: `This request is ${riskLevel}-risk and needs explicit approval before execution. ${reasons}`,
    answerSource: "risk_gate",
    composer: "buildJozRiskGateResolution",
    fallbackUsed: false,
    retrievedCategories: [],
    answerClass: "risk_gate",
    confidence: "high",
  };
}
