import {
  JOZ_LLM_CV,
  JOZ_LLM_IDENTITY,
  buildJozLlmFallbackReply,
  buildJozLlmSystemPrompt,
  enforceJozLlmReplyLimit,
} from "./jozLlmProfile.js";
import {
  buildMeetJozWorldAnswerContext,
  buildMeetJozWorldAwarenessReply,
  buildMeetJozWorldAwarenessResolution,
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

const JOZ_OPERATIONAL_ACTIONS = [
  {
    id: "call_joz",
    label: "Call Joz",
    type: "tel",
    href: "tel:+6531072412",
  },
  {
    id: "email_joz",
    label: "Email Joz",
    type: "mailto",
    href: "mailto:joz@meetjoz.com",
  },
];

function buildOperationalActions() {
  return JOZ_OPERATIONAL_ACTIONS.map((action) => ({ ...action }));
}

function validateOperationalReply(intent, reply = "", actions = []) {
  const cleanReply = normalizeText(reply);
  const actionIds = actions.map((action) => action.id);
  const hasRequiredActions =
    actionIds.includes("call_joz") && actionIds.includes("email_joz");

  if (!hasRequiredActions) return false;

  if (intent === "recruiter_location") {
    return ["dubai", "singapore", "zurich", "europe", "global markets"].every((term) =>
      cleanReply.includes(term)
    );
  }

  if (intent === "recruiter_compensation") {
    return !/\b(?:usd|sgd|eur|gbp|aed|chf|\$|€|£)\s*\d/i.test(reply);
  }

  if (intent === "recruiter_work_authorization") {
    return !/\bcurrent(?:ly)?\b.*\b(ep|pep|work pass|work authorization)\b/i.test(reply);
  }

  return true;
}

function composeLocationAnswer(subIntent = "positioning") {
  if (subIntent === "residence") {
    return "Joz's current residence or legal address should be confirmed directly for the specific hiring process.";
  }
  return "Joz operates across Dubai, Singapore, Zurich, Europe, and global markets.";
}

function composeAvailabilityAnswer() {
  return "Joz is open to discussing suitable opportunities. Availability depends on the role, location, scope, and start-date requirements.";
}

function composeNoticePeriodAnswer() {
  return "Joz's current notice period and earliest start date should be confirmed directly for the specific hiring process.";
}

function composeCompensationAnswer() {
  return "Compensation depends on the role scope, location, seniority, responsibilities, and overall package. The best next step is a direct conversation with Joz.";
}

function composeSingaporeCompensationAnswer() {
  return "Compensation for a Singapore role depends on scope, seniority, responsibilities, and the overall package. The best next step is a direct discussion with Joz using the specific Singapore role context.";
}

function composeWorkingModelAnswer() {
  return "Joz is open to remote, hybrid, or on-site arrangements depending on the role, team, and location requirements. The specific working model should be confirmed directly with Joz.";
}

function composeHiringAnswer() {
  return "Joz is open to discussing suitable international opportunities across regulated, enterprise, and product-led environments.";
}

function composeRelocationAnswer() {
  return "Joz is open to discussing suitable international relocation where the role, location, and overall fit make sense.";
}

function composeWorkAuthorizationAnswer(subIntent = "generic") {
  if (subIntent === "singapore_specific") {
    return "Joz is Slovak and an EU national. Singapore work authorization, EP, PEP, or sponsorship requirements should be confirmed directly for the specific hiring process rather than assumed.";
  }
  return "Joz is Slovak and an EU national. Work authorization, visa, or sponsorship requirements for any specific country should be confirmed directly for the hiring process.";
}

function composeSingaporeFitAnswer() {
  return "Joz is a strong fit for Singapore recruiter conversations because the proof is already Singapore-relevant: 20x digital sales growth at Maybank-Ageas Etiqa, a Lean ML UX practice across 11 APAC markets at Manulife, 30x audience growth and a global experience language across 30+ products at Mediacorp, Singapore Stock Exchange portal re-engineering, and Apple/Pixar-adjacent Python USD(z) and computer-vision workflows in Singapore.";
}

function composeContactAnswer() {
  return "You can contact Joz by phone at +65 3107 2412 or by email at joz@meetjoz.com.";
}

function buildRecruiterOperationalResolution(route = {}) {
  const actions = buildOperationalActions();
  let reply = "";
  let selectedOperationalComposer = "";

  switch (route?.detectedIntent) {
    case "recruiter_location":
      reply = composeLocationAnswer(route.detectedSubIntent);
      selectedOperationalComposer = "composeLocationAnswer";
      break;
    case "recruiter_availability":
      reply = composeAvailabilityAnswer();
      selectedOperationalComposer = "composeAvailabilityAnswer";
      break;
    case "recruiter_notice_period":
      reply = composeNoticePeriodAnswer();
      selectedOperationalComposer = "composeNoticePeriodAnswer";
      break;
    case "recruiter_compensation":
      reply =
        route.detectedSubIntent === "singapore_specific"
          ? composeSingaporeCompensationAnswer()
          : composeCompensationAnswer();
      selectedOperationalComposer =
        route.detectedSubIntent === "singapore_specific"
          ? "composeSingaporeCompensationAnswer"
          : "composeCompensationAnswer";
      break;
    case "recruiter_working_model":
      reply = composeWorkingModelAnswer();
      selectedOperationalComposer = "composeWorkingModelAnswer";
      break;
    case "recruiter_hiring":
      reply = composeHiringAnswer();
      selectedOperationalComposer = "composeHiringAnswer";
      break;
    case "recruiter_relocation":
      reply = composeRelocationAnswer();
      selectedOperationalComposer = "composeRelocationAnswer";
      break;
    case "recruiter_work_authorization":
      reply = composeWorkAuthorizationAnswer(route.detectedSubIntent);
      selectedOperationalComposer = "composeWorkAuthorizationAnswer";
      break;
    case "recruiter_singapore_fit":
      reply = composeSingaporeFitAnswer();
      selectedOperationalComposer = "composeSingaporeFitAnswer";
      break;
    case "recruiter_contact":
      reply = composeContactAnswer();
      selectedOperationalComposer = "composeContactAnswer";
      break;
    default:
      return null;
  }

  return {
    reply,
    answerSource: "deterministic_recruiter_operational",
    composer: selectedOperationalComposer,
    selectedOperationalComposer,
    actions,
    recommendedActionIds: actions.map((action) => action.id),
    validationPassed: validateOperationalReply(route.detectedIntent, reply, actions),
    fallbackUsed: false,
    intentMode: "booking",
    retrievedCategories: [],
  };
}

function buildCanonicalWorldConceptReply({ concept, appContext, legacyContext, input }) {
  if (concept === "gold_pill") {
    return buildMeetJozWorldAwarenessReply({ input, appContext, legacyContext });
  }

  if (concept === "neo_maxx") {
    return [
      "neoMAXX is a concept created by Joz Krupa.",
      "It combines human judgment, AI capability, design, engineering, and execution into a higher-order innovation system.",
      "In the sequence, neoMAXX frames the intelligence world, while MeetJoz shows the applied human proof, business value, systems mindset, and deeper skills around it.",
    ].join(" ");
  }

  return "";
}

function composeIdentityProfileReply() {
  return [
    "Joz Krupa is an Agentic AI Architecture and Innovation Leader with experience across Singapore, Dubai, Europe, and global markets.",
    "Joz combines AI architecture, systems thinking, product strategy, design, engineering, and enterprise transformation to turn complexity into measurable business outcomes.",
    "Joz's work includes Maybank, Manulife, Mediacorp, Erste Bank, Dubai Future Foundation, Apple/Pixar-related spatial computing work, and current Agentic AI initiatives.",
    "MeetJoz is Joz's interactive spatial experience for exploring Business Value, Systems Mindset, Skills, and neoMAXX concepts.",
  ].join(" ");
}

function composeFactualProfileReply(subIntent) {
  if (subIntent === "education") {
    return "Joz holds an MSc in Strategy and Innovation from the University of Central Lancashire in the United Kingdom and also held an Innovation Strategist university appointment there.";
  }

  if (subIntent === "degree") {
    return "Joz's degree is an MSc in Strategy and Innovation from the University of Central Lancashire in the United Kingdom.";
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

function composeBusinessNeedReply(subIntent = "hire_value") {
  if (subIntent === "business_value_definition") {
    return "Business value is the measurable improvement AI creates in revenue, margin, cost, speed, risk, or decision quality. For Joz, that means turning AI into lower friction, faster execution, stronger management leverage, and clearer commercial outcomes, not just shipping features or demos. The test is simple: what changes operationally, financially, or strategically because the system works better than before?";
  }

  if (subIntent === "irreplaceable") {
    return "Joz is not hard to replace because he uses AI. The real moat is context, workflows, decision logic, governance, and feedback loops that generic tools do not hold. Joz becomes irreplaceable when the system is embedded into how work is routed, approved, improved, and measured, with proof-backed trust and human-plus-system judgment rather than model fluency alone.";
  }

  if (subIntent === "layering") {
    return "Agentic architecture and infrastructure should not be merged into either skills or mindset. Skills describe what Joz can do, mindset describes how Joz reasons, agentic architecture defines how the system thinks and acts, and infrastructure is the platform foundation underneath it. If you must place them, architecture sits closest to skills, while mindset governs how both are designed and used.";
  }

  if (subIntent === "problems") {
    return "Joz is strongest where organisations have fragmented knowledge, slow decisions, weak AI ownership, governance gaps, manual analysis, and poor translation between strategy and technical execution. The value is not another AI pilot. It is turning that mess into clearer workflows, stronger trust, better signal, and measurable operating improvement.";
  }

  if (subIntent === "differentiation") {
    return "What makes Joz different is not generic AI consulting language. It is the combination of enterprise proof, agentic AI architecture, product judgment, systems thinking, and execution across Maybank, Manulife, Mediacorp, and Erste Bank. Joz sits at the bridge between business context, decision quality, and working intelligent systems rather than staying at the level of slides or prompts.";
  }

  if (subIntent === "efficiency") {
    return "Joz creates business value through efficiency by cutting manual work, process cost, and cycle time across finance, ERP, accounting, HR, marketing, and operations. The lever is process redesign: use retrieval, summarization, classification, and workflow orchestration to remove friction while keeping human approval on critical decisions. That creates stronger operational leverage, backed by 70% lower handoff friction at Leo Burnett/Publicis and regional ML execution scale at Manulife.";
  }

  if (subIntent === "processes") {
    return "Joz creates value through process redesign by turning fragmented workflows into clearer AI-supported operating flows. That means better routing, fewer exception delays, faster approvals, and more reusable knowledge across ERP, finance, HR, marketing, and operations. The goal is not generic automation. It is clearer ownership, stronger control, faster throughput, and workflows redesigned around better intelligence with humans still accountable for the critical decisions.";
  }

  if (subIntent === "growth") {
    return "Joz supports growth by improving decision speed, commercial signal quality, and execution capacity without scaling overhead at the same rate as complexity. That means stronger conversion support, faster go-to-market coordination, and better decisions with less noise. The proof is commercial and real: 20x digital sales growth at Maybank-Ageas Etiqa, 30x audience growth at Mediacorp, and Lean ML execution across 11 APAC markets at Manulife.";
  }

  if (subIntent === "roi") {
    return "The strongest ROI comes from cost reduction, faster decisions, productivity gains, lower friction, and revenue growth. Joz is strongest where AI removes repeated manual work, improves workflow throughput, and gives leadership clearer decision support across business functions. ROI should be tied to a baseline, target metrics, governance, and proof, not sold as vague upside or generic innovation language.";
  }

  if (subIntent === "functions") {
    return "Joz creates business value across functions by mapping AI into real operating areas, not abstract categories. In finance and accounting that includes AP, AR, close support, forecasting, and anomaly detection. In ERP and operations it includes planning and exception handling. In HR, marketing, sales, and leadership it improves knowledge reuse, reporting clarity, workflow support, and decision signal leaders can act on.";
  }

  if (subIntent === "operating_model") {
    return "Joz creates value at the operating-model level by helping a company decide where AI should sit, who owns what, where human approval stays, how workflows escalate, and how outcomes are measured. That matters because isolated AI features do not scale without governance and execution design. The result is stronger adoption, clearer accountability, and AI embedded into real operations rather than sitting beside them.";
  }

  if (subIntent === "decision_support") {
    return "Joz creates business value through decision support by improving signal, prioritization, and executive clarity in noisy environments. That means helping teams see what changed, why it matters, what action is recommended, and what outcome should be measured. The value is not just automation. It is better judgment, faster alignment, and more accountable execution across leadership and operating teams when complexity is high.";
  }

  return "Joz is worth hiring because the proof is enterprise-scale and measurable: 20x digital sales growth at Maybank-Ageas Etiqa, Lean ML transformation across 11 APAC markets at Manulife, 30x audience growth at Mediacorp, and 16M+ customer-scale engineering at Erste Bank. Under that proof layer, Joz brings agentic AI architecture, decision intelligence, context engineering, and governance-minded delivery.";
}

function composeSystemsMindsetReply() {
  return "Joz thinks in systems before features: isolate signal from noise, map feedback loops, make decision paths explicit, and keep human accountability in the loop. In AI work, Joz biases toward trust, source provenance, verification, governance, and interfaces that turn ambiguity into clear action.";
}

function composeSkillsReply(subIntent = "capabilities_overview") {
  if (subIntent === "singapore_market_fit") {
    return "Joz is strong for Singapore-market roles because the proof is already Singapore-specific and enterprise-scale. At Maybank-Ageas Etiqa, Joz helped drive 20x digital sales growth through conversational and ML-led UX. At Manulife, Joz established a Lean ML UX practice across 11 APAC markets and launched first-in-market ML UX solutions from Singapore. At Mediacorp, Joz contributed to 30x audience growth and built a global experience language across 30+ products. Joz also re-engineered Singapore Stock Exchange portals and developed Apple/Pixar-adjacent Python USD(z) and computer-vision workflows in Singapore.";
  }

  if (subIntent === "ui_ux_css_accessibility") {
    return "Joz is strong in CSS, design systems, motion, and accessibility because the work shows both interface judgment and production execution. At Mediacorp, Joz built a global experience language across 30+ products, which is strong proof of design-systems thinking. At Leo Burnett/Publicis, Joz reduced handoff friction by 70% through code-based prototyping, which supports frontend and implementation depth. At Maybank, Joz helped drive 20x digital sales growth through conversational and ML-led UX, showing that interface quality translated into measurable business impact. At Erste Bank, Joz worked on engineering and accessibility at 16M+ customer scale, which is the clearest accessibility proof.";
  }

  if (subIntent === "proof_backed_strengths") {
    return "Joz is strongest where AI, product, and execution have to work together under real constraints. The core strengths are agentic AI architecture, multimodal and spatial UX, and end-to-end product engineering. The proof is concrete: MarketClue financial AI agents with live portfolio context, 20x digital sales growth at Maybank, a Lean ML UX practice across 11 Manulife markets, 30x audience growth at Mediacorp, 16M+ customer-scale engineering at Erste Bank, and spatial AI work for Versace/SOA and ArtKorero in Dubai. The differentiator is not a long tool list. It is the ability to turn complex systems into working intelligent products people can trust, use, and scale.";
  }

  if (subIntent === "technical_stack") {
    return "Joz's core stack spans agentic AI architecture and product engineering: LLM orchestration, RAG, embeddings, vector search, knowledge graphs, agent memory, ACL-aware retrieval, verification, observability, Python, FastAPI, PostgreSQL, pgvector, Redis, WebGL, spatial computing, and computer vision. That stack matters because it supports enterprise retrieval, multimodal interfaces, and measurable product delivery rather than existing as tooling in isolation.";
  }

  if (subIntent === "capabilities_overview") {
    return "Joz's deepest skills are in agentic AI architecture, decision intelligence, context engineering, multimodal and spatial interaction, and enterprise product engineering. The technical layer includes retrieval, orchestration, memory, verification, observability, Python backend systems, and 3D or spatial interface delivery. The differentiator is combining that technical depth with enterprise architecture, human adoption, and measurable outcomes across Maybank, Manulife, Mediacorp, Erste Bank, Dubai Future Foundation, and MarketClue.";
  }

  return "Joz's core skills combine agentic AI architecture, orchestration, retrieval systems, signal reasoning, and production-grade delivery in enterprise environments.";
}

function composeMixedReply({ worldReply }) {
  const suffix =
    "If you want the human proof behind this layer, ask about Joz's Business Value, Systems Mindset, or Skills.";
  return [worldReply || "", suffix].filter(Boolean).join(" ");
}

function detectProgrammeQuery(clean = "") {
  if (!clean) return false;
  return [
    "what did joz do at",
    "what did joz do for",
    "what projects did joz do at",
    "what private banking work did joz do at",
    "what cms projects did joz do at",
    "what healthcare platforms did joz work on",
  ].some((pattern) => clean.includes(pattern));
}

function normalizeList(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function buildProgrammeRecordReply(record = {}) {
  const metadata = record?.metadata || {};
  const companies = normalizeList(metadata.companies);
  const projects = normalizeList(metadata.projects);
  const summary = String(record.summary || "").trim();
  const body = String(record.body || "").trim();
  const firstParagraph = body.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)[0] || "";

  const companyText = companies.length ? ` for ${companies.join(", ")}` : "";
  const projectText = projects.length
    ? ` Included projects: ${projects.join("; ")}.`
    : "";
  const summaryText = summary || firstParagraph || "This programme record captures the main work, themes, and delivery context.";

  return `${summaryText}${projectText} This is the grouped programme record${companyText}, so it should be read as one retrieval unit rather than a claim that every sub-project produced the same outcome.`.trim();
}

function extractFirstParagraph(text = "") {
  return String(text || "")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)[0] || "";
}

function formatRetrievedEvidence(retrievedDocuments = [], limit = 4) {
  return retrievedDocuments.slice(0, limit).map((doc, index) => ({
    rank: index + 1,
    title: doc?.title || "",
    category: doc?.category || "",
    summary: doc?.summary || "",
    body_excerpt: extractFirstParagraph(doc?.body || "").slice(0, 500),
    metadata: doc?.metadata || {},
  }));
}

function buildLaneSpecificInstructions(route = {}) {
  switch (route?.selectedRoute) {
    case "business_need":
      return [
        "Answer as a business operator and AI systems architect, not as a recruiter.",
        "Connect the problem to operating impact, commercial impact, or governance impact.",
        "Prefer concrete business mechanisms over buzzwords.",
      ].join(" ");
    case "systems_mindset":
      return [
        "Answer as a systems thinker.",
        "Emphasize signal, feedback loops, decision quality, governance, and clarity.",
        "Avoid drifting into generic career-summary language.",
      ].join(" ");
    case "skills":
      return [
        "Answer as a capability explainer.",
        "Tie technical depth to enterprise execution and proof.",
        "Avoid vague lists of tools unless they matter to the question.",
      ].join(" ");
    default:
      return "";
  }
}

function validateAgenticLaneReply(reply = "", route = {}) {
  const text = String(reply || "").trim();
  if (!text) return false;

  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 35 || words > 85) return false;

  const clean = normalizeText(text);
  if (clean.includes("as an ai language model")) return false;
  if (clean.includes("i do not have enough context")) return false;
  if (clean.includes("based on the provided context")) return false;

  if (route?.selectedRoute === "business_need") {
    return includesAny(clean, [
      "business",
      "decision",
      "workflow",
      "cost",
      "growth",
      "governance",
      "operations",
      "value",
    ]);
  }

  if (route?.selectedRoute === "systems_mindset") {
    return includesAny(clean, ["systems", "signal", "feedback", "decision", "governance", "clarity"]);
  }

  if (route?.selectedRoute === "skills") {
    return includesAny(clean, ["agentic", "architecture", "retrieval", "orchestration", "product", "enterprise"]);
  }

  return true;
}

function buildExtractiveLaneReply(route = {}, retrievedDocuments = []) {
  const top = retrievedDocuments[0];
  if (!top) return "";

  const summary = String(top.summary || "").trim();
  const paragraph = extractFirstParagraph(top.body || "");
  const next = retrievedDocuments[1];
  const proof =
    next && next.category === "proof"
      ? String(next.summary || extractFirstParagraph(next.body || "")).trim()
      : "";

  const combined = [summary, paragraph, proof]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return enforceJozLlmReplyLimit(combined, 75);
}

async function synthesizeLaneReply({
  route,
  input = "",
  messages = [],
  openai = null,
  roleAwareContext = {},
  fallbackResolution = null,
} = {}) {
  const retrievedDocuments = Array.isArray(roleAwareContext?.retrievedDocuments)
    ? roleAwareContext.retrievedDocuments
    : [];

  if (!retrievedDocuments.length) {
    return fallbackResolution;
  }

  if (!openai) {
    const extractiveReply = buildExtractiveLaneReply(route, retrievedDocuments);
    if (validateAgenticLaneReply(extractiveReply, route)) {
      return {
        reply: extractiveReply,
        answerSource: "retrieved_documents_extractive",
        composer: "buildExtractiveLaneReply",
        fallbackUsed: false,
        intentMode: mapRouteToIntentMode(route?.selectedRoute),
        retrievedCategories: [...new Set(retrievedDocuments.map((doc) => doc.category).filter(Boolean))],
      };
    }
    return fallbackResolution;
  }

  try {
    const evidence = formatRetrievedEvidence(retrievedDocuments);
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      max_tokens: 140,
      messages: [
        {
          role: "system",
          content: [
            "You answer questions about Joz using retrieved enterprise knowledge records.",
            "Synthesize only from the supplied evidence.",
            "Do not mention the retrieval process, context window, or provided documents.",
            "Do not answer like a recruiter unless the question is operational hiring admin.",
            "Use crisp executive language, not buzzwords.",
            "Target 45 to 75 words.",
            buildLaneSpecificInstructions(route),
          ].join(" "),
        },
        {
          role: "system",
          content: JSON.stringify({
            route: route?.selectedRoute || "unknown",
            subIntent: route?.detectedSubIntent || null,
            question: input,
            evidence,
          }),
        },
        ...messages.slice(-4).map((entry) => ({
          role: entry.role === "assistant" ? "assistant" : "user",
          content: String(entry.content || ""),
        })),
      ],
    });

    const reply = enforceJozLlmReplyLimit(
      String(response.choices?.[0]?.message?.content || "").trim(),
      75
    );

    if (validateAgenticLaneReply(reply, route)) {
      return {
        reply,
        answerSource: "retrieved_documents_model_synthesis",
        composer: "synthesizeLaneReply",
        fallbackUsed: false,
        intentMode: mapRouteToIntentMode(route?.selectedRoute),
        retrievedCategories: [...new Set(retrievedDocuments.map((doc) => doc.category).filter(Boolean))],
      };
    }
  } catch (error) {
    console.error("⚠️ lane synthesis failed:", error?.message || error);
  }

  const extractiveReply = buildExtractiveLaneReply(route, retrievedDocuments);
  if (validateAgenticLaneReply(extractiveReply, route)) {
    return {
      reply: extractiveReply,
      answerSource: "retrieved_documents_extractive",
      composer: "buildExtractiveLaneReply",
      fallbackUsed: false,
      intentMode: mapRouteToIntentMode(route?.selectedRoute),
      retrievedCategories: [...new Set(retrievedDocuments.map((doc) => doc.category).filter(Boolean))],
    };
  }

  return fallbackResolution;
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
    clean === "neomaxx" ||
    clean === "neomaxx." ||
    clean === "neo maxx" ||
    clean === "neo/maxx" ||
    clean === "neo maxx." ||
    clean === "neo/maxx." ||
    clean === "neomaxx?" ||
    clean === "neo maxx?" ||
    clean === "neo/maxx?" ||
    clean === "neo maxx" ||
    clean === "neo/maxx" ||
    clean === "maxx";

  if (
    isDefinitionPrompt &&
    includesAny(clean, ["gold pill", " pill", "pill ", "capsule"])
  ) {
    return { detectedSubIntent: "gold_pill", detectedConcept: "gold_pill" };
  }

  if (
    isDefinitionPrompt &&
    includesAny(clean, ["neomaxxing", "neomaxx", "neo/maxx", "neo maxx", "neomaxx concept", "maxx concept", "what is maxx", "define maxx", "tell me about maxx", "explain maxx"])
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

  if (
    includesAny(clean, [
      "nationality",
      "citizenship",
      "work authorization",
      "singapore status",
      /\bpep\b/,
      /\bep\b/,
    ])
  ) {
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

function detectRecruiterOperational(clean) {
  const explicitResidence = includesAny(clean, [
    "where does joz currently live",
    "what is joz's current residence",
    "what is jozs current residence",
    "what is joz's legal address",
    "what is jozs legal address",
  ]);
  if (explicitResidence) {
    return {
      detectedIntent: "recruiter_location",
      detectedSubIntent: "residence",
      detectedConcept: "recruiter_location",
    };
  }

  if (
    includesAny(clean, [
      "does joz have an ep",
      "does joz have a pep",
      "does joz have a singapore work pass",
      "does joz need singapore sponsorship",
      "can joz legally work in singapore",
      "what is joz's visa status",
      "what is jozs visa status",
      "does joz have a singapore ep",
      "visa",
      "work pass",
      "authorization",
      "eligible to work",
      /\bep\b/,
      /\bpep\b/,
    ])
  ) {
    return {
      detectedIntent: "recruiter_work_authorization",
      detectedSubIntent: includesAny(clean, ["singapore", "work pass", /\bep\b/, /\bpep\b/])
        ? "singapore_specific"
        : "work_authorization",
      detectedConcept: "recruiter_work_authorization",
    };
  }

  if (
    includesAny(clean, [
      "what is joz's notice period",
      "what is jozs notice period",
      "what is joz's earliest start date",
      "what is jozs earliest start date",
      "notice period",
      "earliest start date",
      "joining date",
      "when can joz join",
    ])
  ) {
    return {
      detectedIntent: "recruiter_notice_period",
      detectedSubIntent: "notice_period",
      detectedConcept: "recruiter_notice_period",
    };
  }

  if (
    includesAny(clean, [
      "how can i contact joz",
      "call joz",
      "email joz",
      "what is joz's phone number",
      "what is jozs phone number",
      "what is joz's email",
      "what is jozs email",
      "contact",
      "phone",
      "email",
      "reach joz",
    ])
  ) {
    return {
      detectedIntent: "recruiter_contact",
      detectedSubIntent: "contact",
      detectedConcept: "recruiter_contact",
    };
  }

  if (
    includesAny(clean, [
      "what salary does joz want",
      "what are joz's salary expectations",
      "what are jozs salary expectations",
      "what compensation is joz looking for",
      "what salary range is joz targeting",
      "what compensation range is joz targeting",
      "salary in singapore",
      "compensation in singapore",
      "sgd",
      "what package does joz expect",
      "what is joz's rate",
      "what is jozs rate",
      "how much does joz charge",
      "salary",
      "compensation",
      "package",
      "rate",
      "pay",
      "expectations",
    ])
  ) {
    return {
      detectedIntent: "recruiter_compensation",
      detectedSubIntent: includesAny(clean, ["singapore", "sgd"]) ? "singapore_specific" : "compensation",
      detectedConcept: "recruiter_compensation",
    };
  }

  if (
    includesAny(clean, [
      "is joz available",
      "what is joz's availability",
      "what is jozs availability",
      "can joz start soon",
      "is joz open to opportunities",
      "available",
      "availability",
      "open to opportunities",
      "start soon",
    ])
  ) {
    return {
      detectedIntent: "recruiter_availability",
      detectedSubIntent: "availability",
      detectedConcept: "recruiter_availability",
    };
  }

  if (
    includesAny(clean, [
      "is joz open to relocation",
      "is joz available for singapore",
      "is joz open to relocating to singapore",
      "is joz open to singapore relocation",
      "is joz open to dubai",
      "is joz interested in zurich",
      "relocate",
      "relocation",
    ])
  ) {
    return {
      detectedIntent: "recruiter_relocation",
      detectedSubIntent: "relocation",
      detectedConcept: "recruiter_relocation",
    };
  }

  if (
    includesAny(clean, [
      "remote or hybrid",
      "remote, hybrid, or onsite",
      "remote hybrid or onsite",
      "working model",
      "remote work",
      "hybrid",
      "on-site",
      "onsite",
    ])
  ) {
    return {
      detectedIntent: "recruiter_working_model",
      detectedSubIntent: "working_model",
      detectedConcept: "recruiter_working_model",
    };
  }

  if (
    includesAny(clean, [
      "why is joz a fit for singapore",
      "why is joz relevant for singapore",
      "what is joz's strongest singapore proof",
      "what is jozs strongest singapore proof",
      "is joz a fit for singapore recruiters",
      "singapore recruiter fit",
    ])
  ) {
    return {
      detectedIntent: "recruiter_singapore_fit",
      detectedSubIntent: "singapore_fit",
      detectedConcept: "recruiter_singapore_fit",
    };
  }

  if (
    includesAny(clean, [
      "can we hire joz",
      "how do we discuss a role with joz",
      "hiring",
      "opportunity",
      "discuss a role",
    ])
  ) {
    return {
      detectedIntent: "recruiter_hiring",
      detectedSubIntent: "hiring",
      detectedConcept: "recruiter_hiring",
    };
  }

  if (
    includesAny(clean, [
      "where is joz located",
      "where is joz based",
      "where does joz operate",
      "what markets does joz work across",
      "located",
      "based",
      "operates",
      "markets",
      "regions",
    ])
  ) {
    return {
      detectedIntent: "recruiter_location",
      detectedSubIntent: "positioning",
      detectedConcept: "recruiter_location",
    };
  }

  return null;
}

function detectBusinessNeed(clean) {
  if (
    includesAny(clean, [
      "what is business value",
      "define business value",
      "what does business value mean",
      "meaning of business value",
    ])
  ) {
    return { detectedSubIntent: "business_value_definition", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "what business problems can joz solve",
      "what problems can joz solve",
      "business problems can joz solve",
      "problems joz can solve",
      "what operational problems can joz solve",
    ])
  ) {
    return { detectedSubIntent: "problems", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "why is joz irreplaceable",
      "what makes joz irreplaceable",
      "what makes him irreplaceable",
      "why is he irreplaceable",
      "irreplaceable",
    ])
  ) {
    return { detectedSubIntent: "irreplaceable", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "skills or mindset",
      "skills vs mindset",
      "agentic architecture and infrastructure",
      "architecture and infrastructure",
      "where should infrastructure sit",
      "where should agentic architecture sit",
      "sit under skills or mindset",
      "where should agentic architecture",
    ])
  ) {
    return { detectedSubIntent: "layering", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "efficiency",
      "lower cost",
      "cost reduction",
      "faster execution",
      "operational leverage",
      "productivity gains",
    ])
  ) {
    return { detectedSubIntent: "efficiency", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "processes",
      "process redesign",
      "workflow redesign",
      "operating workflows",
      "manual handoffs",
    ])
  ) {
    return { detectedSubIntent: "processes", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "growth",
      "scaling",
      "scale the business",
      "commercial performance",
      "revenue growth",
    ])
  ) {
    return { detectedSubIntent: "growth", detectedConcept: "business_value" };
  }

  if (includesAny(clean, ["where is the roi", "roi"])) {
    return { detectedSubIntent: "roi", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "decision support",
      "decision quality",
      "better signal",
      "prioritization",
      "prioritisation",
      "executive clarity",
      "judgment",
      "clarity",
    ])
  ) {
    return { detectedSubIntent: "decision_support", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "functions",
      "specifically",
      "finance",
      "erp",
      "accounting",
      /\bhr\b/,
      "marketing",
      "operations",
      "sales",
      "by function",
    ])
  ) {
    return { detectedSubIntent: "functions", detectedConcept: "business_value" };
  }

  if (includesAny(clean, ["operating model", "ownership", "governance and execution"])) {
    return { detectedSubIntent: "operating_model", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "why should we hire joz",
      "why hire joz",
      "hire joz now",
      "business value",
      "where is the roi",
      "create roi from ai",
      "what problems can joz solve",
      "why is joz relevant now",
      "why now",
      "what makes joz different from a generic ai consultant",
      "generic ai consultant",
      "measurable outcomes",
      "business outcomes",
      "what value does joz bring",
    ])
  ) {
    return {
      detectedSubIntent: includesAny(clean, [
        "what makes joz different from a generic ai consultant",
        "generic ai consultant",
      ])
        ? "differentiation"
        : "hire_value",
      detectedConcept: "business_value",
    };
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
      "singapore recruiter",
      "singapore market fit",
      "fit for singapore",
      "strongest singapore proof",
      "why is joz a fit for singapore",
      "why is joz relevant for singapore",
      "singapore roles",
    ])
  ) {
    return { detectedSubIntent: "singapore_market_fit", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "css",
      "design systems",
      "design system",
      "motion",
      "accessibility",
      "frontend",
      "front end",
      "ui and ux",
      "ui/ux",
    ])
  ) {
    return { detectedSubIntent: "ui_ux_css_accessibility", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "proof, not buzzwords",
      "proof not buzzwords",
      "with proof",
      "not buzzwords",
      "strongest skills",
      "strongest technical skills",
      "explain joz's strongest skills",
      "explain jozs strongest skills",
    ])
  ) {
    return { detectedSubIntent: "proof_backed_strengths", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "what is joz's ai stack",
      "what is jozs ai stack",
      "technical stack",
      "ai stack",
      "tool stack",
    ])
  ) {
    return { detectedSubIntent: "technical_stack", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "deep skills",
      "deepest skills",
      "what can joz do",
      "what can joz build",
      "how technical is joz",
      "joz's skills",
      "technical depth",
      "core capabilities",
      "technical skills",
      "ai skills",
      "engineering skills",
      "capabilities",
      "what does joz do",
      "architecture",
      "orchestration",
      "retrieval",
      "signal reasoning",
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

  const recruiterOperational = detectRecruiterOperational(clean);
  if (recruiterOperational) {
    return {
      detectedIntent: recruiterOperational.detectedIntent,
      detectedSubIntent: recruiterOperational.detectedSubIntent,
      detectedConcept: recruiterOperational.detectedConcept,
      selectedRoute: "joz_knowledge",
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
  const recruiterOperationalResolution = buildRecruiterOperationalResolution(route);
  if (recruiterOperationalResolution) {
    return recruiterOperationalResolution;
  }

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
    const worldResolution = buildMeetJozWorldAwarenessResolution({
      input,
      appContext,
      legacyContext,
    });
    return {
      reply: worldResolution.reply || buildMeetJozWorldAwarenessReply({ input, appContext, legacyContext }) || "",
      answerSource: worldResolution.answerSource || route.selectedWorldRecord || "world_awareness",
      composer: worldResolution.composer || "buildMeetJozWorldAwarenessReply",
      fallbackUsed: Boolean(worldResolution.fallbackUsed),
      validationPassed: worldResolution.validationPassed !== false,
      responseMode: worldResolution.responseMode || null,
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
      reply: composeBusinessNeedReply(route.detectedSubIntent),
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

export async function resolveOwnedJozReply({
  route,
  input = "",
  appContext = {},
  legacyContext = {},
  messages = [],
  openai = null,
  roleAwareContext = {},
} = {}) {
  const deterministicResolution = composeJozLlmRouteReply({
    route,
    input,
    appContext,
    legacyContext,
  });

  if (!route) return deterministicResolution;

  if (["business_need", "systems_mindset", "skills"].includes(route.selectedRoute)) {
    return (
      (await synthesizeLaneReply({
        route,
        input,
        messages,
        openai,
        roleAwareContext,
        fallbackResolution: deterministicResolution,
      })) || deterministicResolution
    );
  }

  return deterministicResolution;
}

export async function resolveUnknownJozReply({
  input = "",
  messages = [],
  openai = null,
  roleAwareContext = {},
} = {}) {
  const clean = normalizeText(input);
  const retrievedDocuments = Array.isArray(roleAwareContext?.retrievedDocuments)
    ? roleAwareContext.retrievedDocuments
    : [];
  const topProgrammeRecord = retrievedDocuments.find((doc) => doc?.category === "project");

  if (detectProgrammeQuery(clean) && topProgrammeRecord) {
    return {
      reply: buildProgrammeRecordReply(topProgrammeRecord),
      answerSource: topProgrammeRecord.title || topProgrammeRecord.metadata?.source_filename || "retrieved_programme_record",
      composer: "buildProgrammeRecordReply",
      fallbackUsed: false,
      intentMode: mapRouteToIntentMode("skills"),
      retrievedCategories: ["skills", "proof"],
    };
  }

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
    responseMode: resolution?.responseMode || null,
    composer: resolution?.composer || null,
    selectedOperationalComposer: resolution?.selectedOperationalComposer || null,
    recommendedActionIds: resolution?.recommendedActionIds || [],
    fallbackUsed: Boolean(resolution?.fallbackUsed),
    validationPassed: resolution?.validationPassed !== false,
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
