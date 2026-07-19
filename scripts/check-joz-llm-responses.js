#!/usr/bin/env node

const DEFAULT_TIMEOUT_MS = 20000;

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.JOZ_LLM_BASE_URL || "",
    timeoutMs: Number(process.env.JOZ_LLM_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url" && argv[index + 1]) {
      options.baseUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms" && argv[index + 1]) {
      options.timeoutMs = Number(argv[index + 1]) || DEFAULT_TIMEOUT_MS;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(
    [
      "Usage: node scripts/check-joz-llm-responses.js --base-url https://your-render-url",
      "",
      "Options:",
      "  --base-url     Backend base URL, for example https://your-service.onrender.com",
      "  --timeout-ms   Request timeout in milliseconds (default 20000)",
      "",
      "Environment variables:",
      "  JOZ_LLM_BASE_URL",
      "  JOZ_LLM_TIMEOUT_MS",
    ].join("\n")
  );
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
}

async function postJson(url, body, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload = null;

    try {
      payload = text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error(`Expected JSON from ${url}, received: ${text.slice(0, 300)}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}: ${text.slice(0, 300)}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(text, needle, label) {
  assert(text.toLowerCase().includes(needle.toLowerCase()), `${label}: missing "${needle}"`);
}

function assertExcludes(text, needle, label) {
  assert(!text.toLowerCase().includes(needle.toLowerCase()), `${label}: must not include "${needle}"`);
}

function assertAnyIncludes(text, needles, label) {
  const match = needles.some((needle) => text.toLowerCase().includes(String(needle).toLowerCase()));
  assert(match, `${label}: missing any of [${needles.join(", ")}]`);
}

function checkGoldPill(payload) {
  const reply = String(payload?.reply || "");
  const trace = payload?.trace || {};

  assert(reply.startsWith("The Gold Pill is a core concept within MeetJoz and NEO/MAXX."), "Gold Pill reply must start with the canonical sentence");
  assert(payload?.mode === "canonical_world_concept", "Gold Pill mode must be canonical_world_concept");
  assert(trace.detectedIntent === "canonical_world_concept", "Gold Pill trace.detectedIntent must be canonical_world_concept");
  assert(trace.detectedSubIntent === "gold_pill", "Gold Pill trace.detectedSubIntent must be gold_pill");
  assert(trace.detectedConcept === "gold_pill", "Gold Pill trace.detectedConcept must be gold_pill");
  assert(trace.selectedRoute === "canonical_world_concept", "Gold Pill trace.selectedRoute must be canonical_world_concept");
  assert(trace.selectedWorldRecord === "root_gold_pill / gold_pill concept", "Gold Pill trace.selectedWorldRecord must be root_gold_pill / gold_pill concept");
  assert(trace.answerSource === "root_gold_pill / gold_pill concept", "Gold Pill trace.answerSource must be the world concept record");
  assert(trace.composer === "composeCanonicalWorldConceptReply", "Gold Pill trace.composer must be composeCanonicalWorldConceptReply");
  assert(trace.fallbackUsed === false, "Gold Pill trace.fallbackUsed must be false");

  [
    "online communities",
    "blue pill",
    "red pill",
    "awareness of harsh realities",
    "personal fulfillment",
    "non-traditional methods",
  ].forEach((term) => assertExcludes(reply, term, "Gold Pill reply"));
}

function checkIdentity(payload) {
  const reply = String(payload?.reply || "");
  const trace = payload?.trace || {};

  assert(trace.detectedIntent === "identity_profile", "Identity trace.detectedIntent must be identity_profile");
  assert(trace.detectedSubIntent === "overview", "Identity trace.detectedSubIntent must be overview");
  assert(trace.detectedConcept === "joz_identity", "Identity trace.detectedConcept must be joz_identity");
  assert(trace.selectedRoute === "identity_profile", "Identity trace.selectedRoute must be identity_profile");
  assert(trace.answerSource === "JOZ_LLM_CV + JOZ_LLM_IDENTITY", "Identity trace.answerSource must be profile-backed");
  assert(trace.composer === "composeIdentityProfileReply", "Identity trace.composer must be composeIdentityProfileReply");
  assert(trace.fallbackUsed === false, "Identity trace.fallbackUsed must be false");
  assertIncludes(reply, "Joz Krupa", "Identity reply");
  assertAnyIncludes(reply, ["Maybank", "Manulife", "Mediacorp", "Erste Bank"], "Identity reply");
  assertExcludes(reply, "Joz LLM can explain", "Identity reply");
}

function checkFactualEducation(payload) {
  const reply = String(payload?.reply || "");
  const trace = payload?.trace || {};

  assert(trace.detectedIntent === "factual_profile", "Education trace.detectedIntent must be factual_profile");
  assert(trace.detectedSubIntent === "education", "Education trace.detectedSubIntent must be education");
  assert(trace.detectedConcept === "education", "Education trace.detectedConcept must be education");
  assert(trace.selectedRoute === "factual_profile", "Education trace.selectedRoute must be factual_profile");
  assert(trace.answerSource === "JOZ_LLM_CV.education + JOZ_LLM_IDENTITY", "Education trace.answerSource must be education-backed");
  assert(trace.composer === "composeFactualProfileReply", "Education trace.composer must be composeFactualProfileReply");
  assert(trace.fallbackUsed === false, "Education trace.fallbackUsed must be false");
  assertIncludes(reply, "University of Central Lancashire", "Education reply");
}

function checkBusinessValue(payload) {
  const reply = String(payload?.reply || "");
  const trace = payload?.trace || {};

  assert(reply.length > 0, "Business Value reply must not be empty");
  assert(trace.detectedIntent === "business_need", "Business Value trace.detectedIntent must be business_need");
  assert(trace.detectedSubIntent === "hire_value", "Business Value trace.detectedSubIntent must be hire_value");
  assert(trace.detectedConcept === "business_value", "Business Value trace.detectedConcept must be business_value");
  assert(trace.selectedRoute === "business_need", "Business Value trace.selectedRoute must be business_need");
  assert(trace.answerSource === "JOZ_LLM_CV.experience", "Business Value trace.answerSource must be CV experience");
  assert(trace.composer === "composeBusinessNeedReply", "Business Value trace.composer must be composeBusinessNeedReply");
  assert(trace.fallbackUsed === false, "Business Value trace.fallbackUsed must be false");
  assertAnyIncludes(reply, ["Maybank", "Mediacorp", "Erste Bank", "Manulife"], "Business Value reply");
  assertAnyIncludes(
    reply,
    ["agentic AI architecture", "decision intelligence", "context engineering", "AI governance"],
    "Business Value reply"
  );
  assertAnyIncludes(reply, ["20x", "30x", "16M", "11 APAC"], "Business Value reply");
  [
    "transformative approach",
    "various domains",
    "impactful outcomes",
    "leverage technology",
  ].forEach((term) => assertExcludes(reply, term, "Business Value reply"));
}

function checkMindset(payload) {
  const reply = String(payload?.reply || "");
  const trace = payload?.trace || {};

  assert(reply.length > 0, "Mindset reply must not be empty");
  assert(trace.detectedIntent === "systems_mindset", "Mindset trace.detectedIntent must be systems_mindset");
  assert(trace.detectedSubIntent === "thinking_model", "Mindset trace.detectedSubIntent must be thinking_model");
  assert(trace.detectedConcept === "systems_mindset", "Mindset trace.detectedConcept must be systems_mindset");
  assert(trace.selectedRoute === "systems_mindset", "Mindset trace.selectedRoute must be systems_mindset");
  assert(trace.answerSource === "JOZ_LLM_CV.appliedAiSkills + JOZ_LLM_CV.experience", "Mindset trace.answerSource must be profile-backed");
  assert(trace.composer === "composeSystemsMindsetReply", "Mindset trace.composer must be composeSystemsMindsetReply");
  assert(trace.fallbackUsed === false, "Mindset trace.fallbackUsed must be false");
  assertAnyIncludes(reply, ["systems", "signal", "decision"], "Mindset reply");
  assertAnyIncludes(reply, ["trust", "verification", "clarity", "action"], "Mindset reply");
  [
    "transformative approach",
    "various domains",
    "impactful outcomes",
    "leverage technology",
  ].forEach((term) => assertExcludes(reply, term, "Mindset reply"));
}

function checkSkills(payload) {
  const reply = String(payload?.reply || "");
  const trace = payload?.trace || {};

  assert(reply.length > 0, "Skills reply must not be empty");
  assert(trace.detectedIntent === "skills", "Skills trace.detectedIntent must be skills");
  assert(trace.detectedSubIntent === "capabilities_overview", "Skills trace.detectedSubIntent must be capabilities_overview");
  assert(trace.detectedConcept === "skills", "Skills trace.detectedConcept must be skills");
  assert(trace.selectedRoute === "skills", "Skills trace.selectedRoute must be skills");
  assert(trace.answerSource === "JOZ_LLM_CV.appliedAiSkills + JOZ_LLM_CV.experience", "Skills trace.answerSource must be profile-backed");
  assert(trace.composer === "composeSkillsReply", "Skills trace.composer must be composeSkillsReply");
  assert(trace.fallbackUsed === false, "Skills trace.fallbackUsed must be false");
  assertAnyIncludes(reply, ["agentic AI", "architecture", "orchestration"], "Skills reply");
  assertAnyIncludes(reply, ["enterprise", "Maybank", "Mediacorp", "Erste Bank", "Manulife"], "Skills reply");
  assertAnyIncludes(reply, ["signal reasoning", "retrieval", "production", "observability"], "Skills reply");
  [
    "transformative approach",
    "various domains",
    "impactful outcomes",
    "leverage technology",
  ].forEach((term) => assertExcludes(reply, term, "Skills reply"));
}

function checkRootChoices(payload) {
  const reply = String(payload?.reply || "");
  assert(payload?.mode === "world_awareness", "Root choices mode must be world_awareness");
  assertIncludes(reply, "Root", "Root choices reply");
  assertIncludes(reply, "Gold Pill", "Root choices reply");
  assertAnyIncludes(reply, ["Brain", "Enter"], "Root choices reply");
  assertIncludes(reply, "MAXX", "Root choices reply");
}

function checkKnowledgeGap(payload, expectedTerm) {
  const reply = String(payload?.reply || "");
  const trace = payload?.trace || {};
  assert(payload?.mode === "unknown_fallback", "Knowledge-gap mode must be unknown_fallback");
  assert(trace.answerSource === "knowledge_gap", "Knowledge-gap trace.answerSource must be knowledge_gap");
  assert(trace.composer === "buildUnknownDefinitionGapReply", "Knowledge-gap composer must be buildUnknownDefinitionGapReply");
  assert(trace.answerClass === "knowledge_gap", "Knowledge-gap answerClass must be knowledge_gap");
  assert(trace.confidence === "high", "Knowledge-gap confidence must be high");
  assert(trace.fallbackUsed === false, "Knowledge-gap fallbackUsed must be false");
  assert(reply.startsWith(`${expectedTerm} is not in the current Joz knowledge base.`), "Knowledge-gap reply must preserve the asked term");
  assertExcludes(reply, "Agentic AI Architecture and Innovation", "Knowledge-gap reply");
}

function checkClarificationGuard(payload) {
  const reply = String(payload?.reply || "");
  const trace = payload?.trace || {};
  assert(payload?.mode === "unknown_fallback", "Clarification mode must be unknown_fallback");
  assert(trace.answerSource === "ambiguity_guard", "Clarification trace.answerSource must be ambiguity_guard");
  assertAnyIncludes(
    String(trace.composer || ""),
    ["buildAmbiguousFollowUpReply", "buildShortClarificationReply"],
    "Clarification composer"
  );
  assert(trace.answerClass === "clarification_guard", "Clarification answerClass must be clarification_guard");
  assert(trace.confidence === "high", "Clarification confidence must be high");
  assert(trace.fallbackUsed === false, "Clarification fallbackUsed must be false");
  assertAnyIncludes(reply, ["too ambiguous on its own", "too short to answer reliably"], "Clarification reply");
}

function checkScopeBoundary(payload) {
  const reply = String(payload?.reply || "");
  const trace = payload?.trace || {};
  assert(payload?.mode === "unknown_fallback", "Scope boundary mode must be unknown_fallback");
  assert(trace.answerSource === "scope_boundary", "Scope boundary trace.answerSource must be scope_boundary");
  assertAnyIncludes(
    String(trace.composer || ""),
    ["buildJozScopeBoundaryReply", "buildGenericScopeBoundaryReply"],
    "Scope boundary composer"
  );
  assert(trace.answerClass === "scope_boundary", "Scope boundary answerClass must be scope_boundary");
  assert(trace.confidence === "high", "Scope boundary confidence must be high");
  assert(trace.fallbackUsed === false, "Scope boundary fallbackUsed must be false");
  assertAnyIncludes(reply, ["deterministic Joz answer set", "not in the current Joz knowledge base"], "Scope boundary reply");
  assertExcludes(reply, "Agentic AI Architecture and Innovation", "Scope boundary reply");
}

function checkMaxxScene(payload) {
  const reply = String(payload?.reply || "");
  assert(payload?.mode === "world_awareness", "MAXX scene mode must be world_awareness");
  assertIncludes(reply, "MAXX", "MAXX scene reply");
  assertAnyIncludes(reply, ["Human Neuron", "AI Neuron", "neural visual metaphor"], "MAXX scene reply");
  assertAnyIncludes(reply, ["judgment", "AI capability", "new pathways"], "MAXX scene reply");
}

function checkWhereSkills(payload) {
  const reply = String(payload?.reply || "");
  assert(payload?.mode === "world_awareness", "Where skills mode must be world_awareness");
  assertIncludes(reply, "workf.glb", "Where skills reply");
  assertAnyIncludes(reply, ["after Mogg", "skills panel", "desktop"], "Where skills reply");
}

async function runCase(baseUrl, testCase, timeoutMs) {
  const sessionKey = `check-${testCase.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
  const payload = await postJson(
    `${baseUrl}${testCase.path}`,
    {
      ...testCase.body,
      sessionKey,
    },
    timeoutMs
  );
  testCase.check(payload);
  console.log(`PASS ${testCase.name}`);
}

async function run() {
  const options = parseArgs(process.argv);
  if (options.help) {
    printHelp();
    return;
  }

  const baseUrl = normalizeBaseUrl(options.baseUrl);
  if (!baseUrl) {
    throw new Error("Missing --base-url or JOZ_LLM_BASE_URL");
  }

  console.log(`Checking Joz LLM responses against ${baseUrl}`);

  const cases = [
    {
      name: "Who is Joz?",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "Who is Joz?" }],
        context: {
          currentPortal: "root",
          currentMesh: "ball",
          currentMeshStage: null,
        },
      },
      check: checkIdentity,
    },
    {
      name: "Where did Joz study?",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "Where did Joz study?" }],
        context: {
          currentPortal: "root",
          currentMesh: "ball",
          currentMeshStage: null,
        },
      },
      check: checkFactualEducation,
    },
    {
      name: "What can Joz do?",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What can Joz do?" }],
        context: {
          currentPortal: "meet-joz",
          currentMesh: "skills",
          currentMeshStage: "skills_stop",
        },
      },
      check: checkSkills,
    },
    {
      name: "How does Joz think?",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "How does Joz think?" }],
        context: {
          currentPortal: "root",
          currentMesh: "brain",
          currentMeshStage: null,
          intentMode: "systems_mindset",
        },
      },
      check: checkMindset,
    },
    {
      name: "Why should we hire Joz?",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "Why should we hire Joz?" }],
        context: {
          currentPortal: "root",
          currentMesh: "ball",
          currentMeshStage: null,
        },
      },
      check: checkBusinessValue,
    },
    {
      name: "What is the Gold Pill?",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What is the Gold Pill?" }],
        context: {
          currentPortal: "root",
          currentMesh: "ball",
          currentMeshStage: null,
        },
      },
      check: checkGoldPill,
    },
    {
      name: "What is DIMA?",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What is DIMA?" }],
        context: {
          currentPortal: "meet-joz",
          currentMesh: "skills",
          currentMeshStage: "skills_stop",
        },
      },
      check: (payload) => checkKnowledgeGap(payload, "DIMA"),
    },
    {
      name: "How does Joz do it?",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "How does Joz do it?" }],
        context: {
          currentPortal: "meet-joz",
          currentMesh: "skills",
          currentMeshStage: "skills_stop",
        },
      },
      check: checkClarificationGuard,
    },
    {
      name: "Can Joz solve everything?",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "Can Joz solve everything?" }],
        context: {
          currentPortal: "meet-joz",
          currentMesh: "skills",
          currentMeshStage: "skills_stop",
        },
      },
      check: checkScopeBoundary,
    },
  ];

  for (const testCase of cases) {
    // Serial execution keeps failures easy to isolate against live backends.
    await runCase(baseUrl, testCase, options.timeoutMs);
  }

  console.log("All response checks passed.");
}

run().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
