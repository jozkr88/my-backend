import {
  JOZ_LLM_CV,
  JOZ_LLM_IDENTITY,
  buildJozLlmFallbackReply,
  buildJozLlmSystemPrompt,
} from "./jozLlmProfile.js";
import {
  buildMeetJozWorldAnswerContext,
  buildMeetJozWorldAwarenessReply,
  resolveMeetJozWorldEntity,
} from "./meetJozWorld.js";

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function includesAny(text, patterns = []) {
  return patterns.some((pattern) =>
    pattern instanceof RegExp ? pattern.test(text) : text.includes(String(pattern))
  );
}

function buildCanonicalWorldConceptReply({ concept, appContext, legacyContext, input }) {
  if (concept === "gold_pill") {
    return buildMeetJozWorldAwarenessReply({ input, appContext, legacyContext });
  }

  if (concept === "neo_maxx") {
    return [
      "NEO/MAXX is Joz Krupa's concept for combining human judgment, AI capability, design, engineering, and execution into a higher-order innovation system.",
      "It is the conceptual layer behind the spatial experience: MAXX frames the intelligence world, while MeetJoz shows the applied human proof, business value, systems mindset, and deeper skills.",
    ].join(" ");
  }

  return "";
}

function composeIdentityProfileReply() {
  return [
    "Joz Krupa is an Agentic AI Architecture and Innovation Leader with experience across Singapore, Dubai, Europe, and global markets.",
    "Joz combines AI architecture, systems thinking, product strategy, design, engineering, and enterprise transformation to turn complexity into measurable business outcomes.",
    "Joz's work includes Maybank, Manulife, Mediacorp, Erste Bank, Dubai Future Foundation, Apple/Pixar-related spatial computing work, and current Agentic AI initiatives.",
    "MeetJoz is Joz's interactive spatial experience for exploring Business Value, Systems Mindset, Skills, and NEO/MAXX concepts.",
  ].join(" ");
}

function composeFactualProfileReply(subIntent) {
  if (subIntent === "education") {
    return "Joz holds an MSc in Strategy and Innovation from the University of Lancashire in the United Kingdom and also held an Innovation Strategist university appointment there.";
  }

  if (subIntent === "degree") {
    return "Joz's degree is an MSc in Strategy and Innovation from the University of Lancashire in the United Kingdom.";
  }

  if (subIntent === "certifications") {
    return "Joz's certifications and advanced training include MIT/IDEO Design Thinking, HPI d.school prototyping labs, and Apple Design Labs plus Apple Engineering Labs and WWDC programs focused on AI and spatial computing.";
  }

  if (subIntent === "location") {
    return "Joz operates across Bratislava, Slovakia, Singapore, Dubai, Zurich, Europe, and global markets.";
  }

  if (subIntent === "contact") {
    return `Joz can be reached at ${JOZ_LLM_IDENTITY.email}, ${JOZ_LLM_IDENTITY.phone}, and ${JOZ_LLM_IDENTITY.website}.`;
  }

  if (subIntent === "nationality") {
    return JOZ_LLM_IDENTITY.recruiterAnswers.nationality;
  }

  if (subIntent === "availability") {
    return JOZ_LLM_IDENTITY.recruiterAnswers.availability;
  }

  if (subIntent === "experience") {
    return JOZ_LLM_IDENTITY.recruiterAnswers.experience;
  }

  return "";
}

function composeBusinessNeedReply() {
  return "Joz is worth hiring because the proof is enterprise-scale and measurable: 20x digital sales growth at Maybank-Ageas Etiqa, 30x audience growth at Mediacorp, 16M+ customer-scale engineering at Erste Bank, and Lean ML transformation across 11 APAC markets at Manulife. Under that proof layer, Joz brings agentic AI architecture, decision intelligence, context engineering, and governance-minded delivery.";
}

function composeSystemsMindsetReply() {
  return "Joz thinks in systems before features: isolate signal from noise, map feedback loops, make decision paths explicit, and keep human accountability in the loop. In AI work, Joz biases toward trust, source provenance, verification, governance, and interfaces that turn ambiguity into clear action.";
}

function composeSkillsReply(subIntent = "capabilities_overview") {
  if (subIntent === "capabilities_overview") {
    return "Joz is strongest in agentic AI architecture, orchestration, retrieval-backed intelligence, signal reasoning, multimodal UX, and production-grade decision systems. The proof spans Maybank, Manulife, Mediacorp, Erste Bank, Dubai Future Foundation, and Apple/Pixar-adjacent spatial computing work.";
  }

  return "Joz's core skills combine agentic AI architecture, orchestration, retrieval systems, signal reasoning, and production-grade delivery in enterprise environments.";
}

function composeMixedReply({ worldReply }) {
  const suffix =
    "If you want the human proof behind this layer, ask about Joz's Business Value, Systems Mindset, or Skills.";
  return [worldReply || "", suffix].filter(Boolean).join(" ");
}

function mapRouteToIntentMode(route) {
  if (route === "business_need") return "business_need";
  if (route === "systems_mindset") return "systems_mindset";
  if (route === "skills") return "skills";
  if (route === "booking") return "booking";
  return "skills";
}

function detectCanonicalWorldConcept(clean) {
  const isDefinitionPrompt =
    /^(what is|what's|explain|tell me about|define)\b/.test(clean) ||
    clean === "gold pill" ||
    clean === "pill" ||
    clean === "capsule" ||
    clean === "neomaxxing" ||
    clean === "neo maxx" ||
    clean === "neo/maxx";

  if (
    isDefinitionPrompt &&
    includesAny(clean, ["gold pill", " pill", "pill ", "capsule"])
  ) {
    return { detectedSubIntent: "gold_pill", detectedConcept: "gold_pill" };
  }

  if (
    isDefinitionPrompt &&
    includesAny(clean, ["neomaxxing", "neo/maxx", "neo maxx", "maxx concept"])
  ) {
    return { detectedSubIntent: "neo_maxx", detectedConcept: "neo_maxx" };
  }

  return null;
}

function detectIdentityProfile(clean) {
  if (
    includesAny(clean, [
      /^who is joz\b/,
      "tell me about joz",
      "introduce joz",
      "who is behind meetjoz",
      "who is behind meet joz",
      "who created neo/maxx",
      "who created neo maxx",
      "who built this experience",
      "who built meetjoz",
      "who built meet joz",
      "who created this experience",
    ])
  ) {
    return { detectedSubIntent: "overview", detectedConcept: "joz_identity" };
  }

  return null;
}

function detectFactualProfile(clean) {
  if (
    includesAny(clean, [
      "where did joz study",
      "where did he study",
      "where did joz go to school",
      "what did joz study",
      "education",
      "studied",
      "university",
      "school",
    ])
  ) {
    return { detectedSubIntent: "education", detectedConcept: "education" };
  }

  if (includesAny(clean, ["what degree does joz have", "what degree", "msc"])) {
    return { detectedSubIntent: "degree", detectedConcept: "degree" };
  }

  if (
    includesAny(clean, [
      "what certifications does joz have",
      "certification",
      "certifications",
      "mit/ideo",
      "hpi",
      "wwdc",
      "apple design labs",
    ])
  ) {
    return { detectedSubIntent: "certifications", detectedConcept: "certifications" };
  }

  if (includesAny(clean, ["where is joz based", "where is joz located", "location", "based in"])) {
    return { detectedSubIntent: "location", detectedConcept: "location" };
  }

  if (
    includesAny(clean, [
      "how can i contact joz",
      "contact joz",
      "email joz",
      "phone joz",
      "reach joz",
      "contact details",
    ])
  ) {
    return { detectedSubIntent: "contact", detectedConcept: "contact" };
  }

  if (includesAny(clean, ["nationality", "citizenship", "work authorization", "singapore status", "pep", "ep"])) {
    return { detectedSubIntent: "nationality", detectedConcept: "nationality" };
  }

  if (includesAny(clean, ["availability", "start date", "notice period", "when can joz start"])) {
    return { detectedSubIntent: "availability", detectedConcept: "availability" };
  }

  if (includesAny(clean, ["years of experience", "how many years", "experience overall", "years in ai"])) {
    return { detectedSubIntent: "experience", detectedConcept: "experience" };
  }

  return null;
}

function detectBusinessNeed(clean) {
  if (
    includesAny(clean, [
      "why should we hire joz",
      "why hire joz",
      "business value",
      "where is the roi",
      "what problems can joz solve",
      "why is joz relevant now",
      "why now",
      "measurable outcomes",
      "business outcomes",
      "what value does joz bring",
    ])
  ) {
    return { detectedSubIntent: "hire_value", detectedConcept: "business_value" };
  }

  return null;
}

function detectSystemsMindset(clean) {
  if (
    includesAny(clean, [
      "how does joz think",
      "systems mindset",
      "systems thinking",
      "decision-making",
      "decision making",
      "signal over noise",
      "feedback loops",
      "governance mindset",
      "agentic ai judgment",
    ])
  ) {
    return { detectedSubIntent: "thinking_model", detectedConcept: "systems_mindset" };
  }

  return null;
}

function detectSkills(clean) {
  if (
    includesAny(clean, [
      "what can joz do",
      "joz's skills",
      "strongest skills",
      "capabilities",
      "what does joz do",
      "architecture",
      "orchestration",
      "retrieval",
      "signal reasoning",
      "technical stack",
    ])
  ) {
    return { detectedSubIntent: "capabilities_overview", detectedConcept: "skills" };
  }

  return null;
}

export function routeJozLlmQuery({ input = "", appContext = {}, legacyContext = {} } = {}) {
  const clean = normalizeText(input);
  const worldContext = buildMeetJozWorldAnswerContext({ input, appContext, legacyContext });
  const worldEntity = resolveMeetJozWorldEntity({ input, appContext, legacyContext });

  const canonical = detectCanonicalWorldConcept(clean);
  if (canonical) {
    return {
      detectedIntent: "canonical_world_concept",
      detectedSubIntent: canonical.detectedSubIntent,
      detectedConcept: canonical.detectedConcept,
      selectedRoute: "canonical_world_concept",
      selectedWorldRecord:
        canonical.detectedConcept === "gold_pill" ? worldEntity.worldRecord || "root_gold_pill / gold_pill concept" : null,
      worldContext,
      worldEntity,
    };
  }

  if (worldContext.route === "world_awareness") {
    return {
      detectedIntent: "world_awareness",
      detectedSubIntent: "spatial_context",
      detectedConcept: worldEntity.entity || null,
      selectedRoute: "world_awareness",
      selectedWorldRecord: worldEntity.worldRecord || null,
      worldContext,
      worldEntity,
    };
  }

  const identity = detectIdentityProfile(clean);
  if (identity) {
    return {
      detectedIntent: "identity_profile",
      detectedSubIntent: identity.detectedSubIntent,
      detectedConcept: identity.detectedConcept,
      selectedRoute: "identity_profile",
      selectedWorldRecord: null,
      worldContext,
      worldEntity,
    };
  }

  const factual = detectFactualProfile(clean);
  if (factual) {
    return {
      detectedIntent: "factual_profile",
      detectedSubIntent: factual.detectedSubIntent,
      detectedConcept: factual.detectedConcept,
      selectedRoute: "factual_profile",
      selectedWorldRecord: null,
      worldContext,
      worldEntity,
    };
  }

  const businessNeed = detectBusinessNeed(clean);
  if (businessNeed) {
    return {
      detectedIntent: "business_need",
      detectedSubIntent: businessNeed.detectedSubIntent,
      detectedConcept: businessNeed.detectedConcept,
      selectedRoute: "business_need",
      selectedWorldRecord: null,
      worldContext,
      worldEntity,
    };
  }

  const systemsMindset = detectSystemsMindset(clean);
  if (systemsMindset) {
    return {
      detectedIntent: "systems_mindset",
      detectedSubIntent: systemsMindset.detectedSubIntent,
      detectedConcept: systemsMindset.detectedConcept,
      selectedRoute: "systems_mindset",
      selectedWorldRecord: null,
      worldContext,
      worldEntity,
    };
  }

  const skills = detectSkills(clean);
  if (skills) {
    return {
      detectedIntent: "skills",
      detectedSubIntent: skills.detectedSubIntent,
      detectedConcept: skills.detectedConcept,
      selectedRoute: "skills",
      selectedWorldRecord: null,
      worldContext,
      worldEntity,
    };
  }

  if (worldContext.route === "mixed") {
    return {
      detectedIntent: "mixed",
      detectedSubIntent: "world_and_profile",
      detectedConcept: worldEntity.entity || null,
      selectedRoute: "mixed",
      selectedWorldRecord: worldEntity.worldRecord || null,
      worldContext,
      worldEntity,
    };
  }

  return {
    detectedIntent: "unknown_fallback",
    detectedSubIntent: "general",
    detectedConcept: null,
    selectedRoute: "unknown_fallback",
    selectedWorldRecord: null,
    worldContext,
    worldEntity,
  };
}

export function composeJozLlmRouteReply({
  route,
  input = "",
  appContext = {},
  legacyContext = {},
} = {}) {
  if (route?.selectedRoute === "canonical_world_concept") {
    return {
      reply: buildCanonicalWorldConceptReply({
        concept: route.detectedConcept,
        appContext,
        legacyContext,
        input,
      }),
      answerSource:
        route.detectedConcept === "gold_pill"
          ? route.selectedWorldRecord || "root_gold_pill / gold_pill concept"
          : "JOZ_LLM_CV.headline",
      composer: "composeCanonicalWorldConceptReply",
      fallbackUsed: false,
      intentMode: "skills",
      retrievedCategories: [],
    };
  }

  if (route?.selectedRoute === "world_awareness") {
    return {
      reply: buildMeetJozWorldAwarenessReply({ input, appContext, legacyContext }) || "",
      answerSource: route.selectedWorldRecord || "world_awareness",
      composer: "buildMeetJozWorldAwarenessReply",
      fallbackUsed: false,
      intentMode: "skills",
      retrievedCategories: [],
    };
  }

  if (route?.selectedRoute === "identity_profile") {
    return {
      reply: composeIdentityProfileReply(),
      answerSource: "JOZ_LLM_CV + JOZ_LLM_IDENTITY",
      composer: "composeIdentityProfileReply",
      fallbackUsed: false,
      intentMode: "skills",
      retrievedCategories: ["bio", "proof"],
    };
  }

  if (route?.selectedRoute === "factual_profile") {
    return {
      reply: composeFactualProfileReply(route.detectedSubIntent),
      answerSource:
        route.detectedSubIntent === "contact" || route.detectedSubIntent === "nationality" || route.detectedSubIntent === "availability"
          ? "JOZ_LLM_IDENTITY.recruiterAnswers"
          : "JOZ_LLM_CV.education + JOZ_LLM_IDENTITY",
      composer: "composeFactualProfileReply",
      fallbackUsed: false,
      intentMode: "skills",
      retrievedCategories: ["faq", "bio"],
    };
  }

  if (route?.selectedRoute === "business_need") {
    return {
      reply: composeBusinessNeedReply(),
      answerSource: "JOZ_LLM_CV.experience",
      composer: "composeBusinessNeedReply",
      fallbackUsed: false,
      intentMode: "business_need",
      retrievedCategories: ["business_need", "proof"],
    };
  }

  if (route?.selectedRoute === "systems_mindset") {
    return {
      reply: composeSystemsMindsetReply(),
      answerSource: "JOZ_LLM_CV.appliedAiSkills + JOZ_LLM_CV.experience",
      composer: "composeSystemsMindsetReply",
      fallbackUsed: false,
      intentMode: "systems_mindset",
      retrievedCategories: ["systems_mindset", "proof"],
    };
  }

  if (route?.selectedRoute === "skills") {
    return {
      reply: composeSkillsReply(route.detectedSubIntent),
      answerSource: "JOZ_LLM_CV.appliedAiSkills + JOZ_LLM_CV.experience",
      composer: "composeSkillsReply",
      fallbackUsed: false,
      intentMode: "skills",
      retrievedCategories: ["skills", "proof"],
    };
  }

  if (route?.selectedRoute === "mixed") {
    return {
      reply: composeMixedReply({
        worldReply: buildMeetJozWorldAwarenessReply({ input, appContext, legacyContext }),
      }),
      answerSource: "world_awareness + JOZ_LLM_CV",
      composer: "composeMixedReply",
      fallbackUsed: false,
      intentMode: "skills",
      retrievedCategories: ["bio", "proof"],
    };
  }

  return null;
}

export async function resolveUnknownJozReply({
  input = "",
  messages = [],
  openai = null,
  roleAwareContext = {},
} = {}) {
  let reply = "";
  let answerSource = "llm_fallback";
  let composer = "buildJozLlmFallbackReply";
  let fallbackUsed = true;

  if (openai && process.env.OPENAI_API_KEY) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.35,
        max_tokens: 90,
        messages: [
          {
            role: "system",
            content: buildJozLlmSystemPrompt(),
          },
          {
            role: "system",
            content: JSON.stringify(roleAwareContext),
          },
          ...messages.slice(-8).map((entry) => ({
            role: entry.role === "assistant" ? "assistant" : "user",
            content: String(entry.content || ""),
          })),
        ],
      });

      reply = String(response.choices?.[0]?.message?.content || "").trim();
      if (reply) {
        answerSource = "openai_model";
        composer = "openai.chat.completions.create";
        fallbackUsed = false;
      }
    } catch (error) {
      console.error("⚠️ /api/joz-llm model call failed:", error?.message || error);
    }
  }

  if (!reply) {
    reply = buildJozLlmFallbackReply(input);
  }

  return {
    reply,
    answerSource,
    composer,
    fallbackUsed,
    intentMode: mapRouteToIntentMode("unknown_fallback"),
    retrievedCategories: [],
  };
}

export function assertNoFallbackHijack(route, resolution) {
  if (route?.selectedRoute !== "unknown_fallback" && resolution?.fallbackUsed) {
    throw new Error(`Fallback hijack detected for route ${route.selectedRoute}`);
  }
}

export function buildJozRouteTrace(route, resolution) {
  return {
    detectedIntent: route?.detectedIntent || "unknown_fallback",
    detectedSubIntent: route?.detectedSubIntent || null,
    detectedConcept: route?.detectedConcept || null,
    selectedRoute: route?.selectedRoute || "unknown_fallback",
    selectedWorldRecord: route?.selectedWorldRecord || null,
    answerSource: resolution?.answerSource || null,
    composer: resolution?.composer || null,
    fallbackUsed: Boolean(resolution?.fallbackUsed),
  };
}

export function buildRoleAwareJozContext({
  buildJozLlmContext,
  profile,
  context = {},
  intentMode = "skills",
  retrievedDocuments = [],
} = {}) {
  return {
    ...buildJozLlmContext(),
    runtime: {
      currentPortal: context?.currentPortal || "root",
      currentMesh: context?.currentMesh || null,
      currentMeshStage: context?.currentMeshStage || null,
      targetRole: context?.targetRole || "Advanced Data Scientist",
      intentMode,
    },
    profile,
    retrievedDocuments,
    cv: JOZ_LLM_CV,
    identity: JOZ_LLM_IDENTITY,
  };
}
