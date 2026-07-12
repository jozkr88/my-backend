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

function assertMaxWords(text, maxWords, label) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  assert(words.length <= maxWords, `${label}: expected at most ${maxWords} words, received ${words.length}`);
}

function checkGoldPill(payload) {
  const reply = String(payload?.reply || "");
  const trace = payload?.trace || {};

  assert(reply.startsWith("The Gold Pill is a core concept within MeetJoz and NEO/MAXX."), "Gold Pill reply must start with the canonical sentence");
  assert(payload?.mode === "world_awareness", "Gold Pill mode must be world_awareness");
  assert(trace.detectedIntent === "world_awareness", "Gold Pill trace.detectedIntent must be world_awareness");
  assert(trace.detectedConcept === "gold_pill", "Gold Pill trace.detectedConcept must be gold_pill");
  assert(trace.selectedRoute === "world_awareness", "Gold Pill trace.selectedRoute must be world_awareness");
  assert(trace.selectedWorldRecord === "root_gold_pill / gold_pill concept", "Gold Pill trace.selectedWorldRecord must be root_gold_pill / gold_pill concept");

  [
    "online communities",
    "blue pill",
    "red pill",
    "awareness of harsh realities",
    "personal fulfillment",
    "non-traditional methods",
  ].forEach((term) => assertExcludes(reply, term, "Gold Pill reply"));
}

function checkNeoMaxx(payload) {
  const reply = String(payload?.reply || "");

  assert(reply.startsWith("Neomaxxing is a concept created by Joz Krupa."), "Neomaxxing reply must start with the canonical sentence");
  assert(payload?.mode === "world_awareness", "Neomaxxing mode must be world_awareness");
  assert(payload?.trace?.detectedConcept === "neo_maxx", "Neomaxxing trace.detectedConcept must be neo_maxx");

  [
    "NEO",
    "MAXX",
    "human judgment",
    "AI",
    "innovation",
    "design",
    "engineering",
    "computation",
    "execution",
    "MAXX portal",
    "neuron metaphor",
  ].forEach((term) => assertIncludes(reply, term, "Neomaxxing reply"));

  [
    "transformative approach",
    "various domains",
    "impactful outcomes",
    "leverage technology",
  ].forEach((term) => assertExcludes(reply, term, "Neomaxxing reply"));
}

function checkBusinessValue(payload) {
  const reply = String(payload?.reply || "");

  assert(payload?.mode === "deterministic", "Business Value mode must be deterministic");
  assert(payload?.source === "deterministic_composer", "Business Value source must be deterministic_composer");
  assertAnyIncludes(reply, ["Maybank", "Mediacorp", "Erste Bank", "Manulife"], "Business Value reply");
  assertAnyIncludes(reply, ["agentic AI architecture", "decision intelligence", "context engineering"], "Business Value reply");
  assertAnyIncludes(reply, ["20x", "30x", "16M", "11 APAC"], "Business Value reply");
  assertMaxWords(reply, 55, "Business Value reply");
}

function checkMindset(payload) {
  const reply = String(payload?.reply || "");

  assert(payload?.mode === "deterministic", "Mindset mode must be deterministic");
  assert(payload?.source === "deterministic_composer", "Mindset source must be deterministic_composer");
  assertAnyIncludes(reply, ["systems", "signal", "decision"], "Mindset reply");
  assertAnyIncludes(reply, ["human judgment", "clarity", "verification", "action"], "Mindset reply");
  assertMaxWords(reply, 55, "Mindset reply");
}

function checkSkills(payload) {
  const reply = String(payload?.reply || "");

  assert(payload?.mode === "deterministic", "Skills mode must be deterministic");
  assert(payload?.source === "deterministic_composer", "Skills source must be deterministic_composer");
  assertAnyIncludes(reply, ["agentic AI architecture", "orchestration", "retrieval", "production observability"], "Skills reply");
  assertAnyIncludes(reply, ["Maybank", "Mediacorp", "Erste Bank", "Manulife"], "Skills reply");
  assertAnyIncludes(reply, ["signal reasoning", "Python/SQL", "workflow-aware"], "Skills reply");
  assertMaxWords(reply, 55, "Skills reply");
}

function checkRootChoices(payload) {
  const reply = String(payload?.reply || "");
  assert(payload?.mode === "world_awareness", "Root choices mode must be world_awareness");
  assertIncludes(reply, "Root", "Root choices reply");
  assertIncludes(reply, "Gold Pill", "Root choices reply");
  assertAnyIncludes(reply, ["Brain", "Enter"], "Root choices reply");
  assertIncludes(reply, "MAXX", "Root choices reply");
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

function checkFlex(payload) {
  const reply = String(payload?.reply || "");
  assert(payload?.mode === "world_awareness", "Flex mode must be world_awareness");
  assertAnyIncludes(reply, ["Flex", "Vibe"], "Flex reply");
  assertAnyIncludes(reply, ["presence", "atmosphere", "arrival"], "Flex reply");
}

function checkAscend(payload) {
  const reply = String(payload?.reply || "");
  assert(payload?.mode === "world_awareness", "Ascend mode must be world_awareness");
  assertAnyIncludes(reply, ["Ascend", "Discover"], "Ascend reply");
  assertAnyIncludes(reply, ["prestige", "recognition", "visible proof"], "Ascend reply");
}

function checkMogg(payload) {
  const reply = String(payload?.reply || "");
  assert(payload?.mode === "world_awareness", "Mogg mode must be world_awareness");
  assertIncludes(reply, "Mogg", "Mogg reply");
  assertAnyIncludes(reply, ["digital twin", "conceptual identity"], "Mogg reply");
}

async function runCase(baseUrl, testCase, timeoutMs) {
  const payload = await postJson(`${baseUrl}${testCase.path}`, testCase.body, timeoutMs);
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
      name: "Gold Pill",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What is the gold pill?" }],
        context: {
          currentPortal: "root",
          currentMesh: "ball",
          currentMeshStage: null,
        },
      },
      check: checkGoldPill,
    },
    {
      name: "Neomaxxing",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What is Neomaxxing?" }],
        context: {
          currentPortal: "maxx",
          currentMesh: "brain",
          currentMeshStage: "signal_flow",
        },
      },
      check: checkNeoMaxx,
    },
    {
      name: "Business Value",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "Why should a company hire Joz right now for an agentic AI and AI systems role?" }],
        context: {
          currentPortal: "root",
          currentMesh: "ball",
          currentMeshStage: null,
          intentMode: "business_need",
        },
      },
      check: checkBusinessValue,
    },
    {
      name: "Systems Mindset",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "Explain how Joz thinks about intelligence, systems, and decision-making." }],
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
      name: "Joz Skills",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "Show Joz's strongest agentic AI systems and orchestration capabilities, with emphasis on company scale and enterprise context." }],
        context: {
          currentPortal: "meet-joz",
          currentMesh: "skills",
          currentMeshStage: "skills_stop",
          intentMode: "skills",
        },
      },
      check: checkSkills,
    },
    {
      name: "Root Choices",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What are my choices?" }],
        context: {
          currentPortal: "root",
          currentMesh: "brain",
          currentMeshStage: null,
        },
      },
      check: checkRootChoices,
    },
    {
      name: "MAXX Scene",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What am I looking at?" }],
        context: {
          currentPortal: "maxx",
          currentMesh: "brain",
          currentMeshStage: "signal_flow",
        },
      },
      check: checkMaxxScene,
    },
    {
      name: "Where Are Joz's Skills",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "Where are Joz's skills?" }],
        context: {
          currentPortal: "meet-joz",
          currentMesh: "skills",
          currentMeshStage: "skills_stop",
        },
      },
      check: checkWhereSkills,
    },
    {
      name: "Flex",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What stage am I in?" }],
        context: {
          currentPortal: "meet-joz",
          currentMesh: "flex",
          currentMeshStage: "meet_joz_flex_stage",
        },
      },
      check: checkFlex,
    },
    {
      name: "Ascend",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What stage am I in?" }],
        context: {
          currentPortal: "meet-joz",
          currentMesh: "ascend",
          currentMeshStage: "meet_joz_ascend_stage",
        },
      },
      check: checkAscend,
    },
    {
      name: "Mogg",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What stage am I in?" }],
        context: {
          currentPortal: "meet-joz",
          currentMesh: "mogg",
          currentMeshStage: "meet_joz_mogg_stage",
        },
      },
      check: checkMogg,
    },
  ];

  for (const testCase of cases) {
    await runCase(baseUrl, testCase, options.timeoutMs);
  }

  console.log("All response checks passed.");
}

run().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
