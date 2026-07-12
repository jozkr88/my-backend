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
      "This suite checks route, concept, fallback usage, context trace,",
      "required facts, and forbidden content for canonical MeetJoz terms.",
    ].join("\n")
  );
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
}

async function postJson(url, body, timeoutMs, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
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

function fail(message) {
  throw new Error(message);
}

function includesAny(text, terms = []) {
  const lower = String(text || "").toLowerCase();
  return terms.some((term) => lower.includes(String(term).toLowerCase()));
}

function includesAll(text, terms = []) {
  const lower = String(text || "").toLowerCase();
  return terms.every((term) => lower.includes(String(term).toLowerCase()));
}

function wordCount(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function classifyFailure({ payload, expected, reply }) {
  const trace = payload?.trace || {};
  if (expected.route && trace.selectedRoute !== expected.route) return "route";
  if (expected.concept && trace.detectedConcept !== expected.concept) return "resolver";
  if (expected.fallbackUsed !== undefined && trace.fallbackUsed !== expected.fallbackUsed) return "composition";
  if (expected.requiredTerms?.length && !includesAll(reply, expected.requiredTerms)) return payload?.mode === "world_awareness" ? "composition" : "retrieval";
  if (expected.forbiddenTerms?.length && includesAny(reply, expected.forbiddenTerms)) return "composition";
  if (expected.context?.currentPortal && trace.currentPortal !== expected.context.currentPortal) return "context";
  if (expected.context?.currentStage && trace.currentStage !== expected.context.currentStage) return "context";
  if (expected.context?.focusedObject && trace.focusedObject !== expected.context.focusedObject) return "context";
  if (expected.context?.deviceClass && trace.deviceClass !== expected.context.deviceClass) return "context";
  return "frontend_rendering";
}

function assertTraceShape(payload, label) {
  const trace = payload?.trace || {};
  const fields = [
    "detectedIntent",
    "detectedConcept",
    "selectedRoute",
    "selectedWorldRecord",
    "answerSource",
    "fallbackUsed",
    "currentPortal",
    "currentStage",
    "focusedObject",
    "deviceClass",
  ];

  for (const field of fields) {
    if (!(field in trace)) {
      fail(`${label}: trace missing "${field}"`);
    }
  }
}

function assertExpected(payload, spec) {
  const reply = String(payload?.reply || "");
  const trace = payload?.trace || {};
  const { name, expected } = spec;

  assertTraceShape(payload, name);

  if (expected.route && trace.selectedRoute !== expected.route) {
    fail(`${name}: expected route=${expected.route}, received ${trace.selectedRoute}`);
  }
  if (expected.concept && trace.detectedConcept !== expected.concept) {
    fail(`${name}: expected concept=${expected.concept}, received ${trace.detectedConcept}`);
  }
  if (expected.fallbackUsed !== undefined && trace.fallbackUsed !== expected.fallbackUsed) {
    fail(`${name}: expected fallbackUsed=${expected.fallbackUsed}, received ${trace.fallbackUsed}`);
  }
  if (expected.context?.currentPortal && trace.currentPortal !== expected.context.currentPortal) {
    fail(`${name}: expected currentPortal=${expected.context.currentPortal}, received ${trace.currentPortal}`);
  }
  if (expected.context?.currentStage && trace.currentStage !== expected.context.currentStage) {
    fail(`${name}: expected currentStage=${expected.context.currentStage}, received ${trace.currentStage}`);
  }
  if (expected.context?.focusedObject && trace.focusedObject !== expected.context.focusedObject) {
    fail(`${name}: expected focusedObject=${expected.context.focusedObject}, received ${trace.focusedObject}`);
  }
  if (expected.context?.deviceClass && trace.deviceClass !== expected.context.deviceClass) {
    fail(`${name}: expected deviceClass=${expected.context.deviceClass}, received ${trace.deviceClass}`);
  }
  if (expected.requiredTerms?.length && !includesAll(reply, expected.requiredTerms)) {
    fail(`${name}: missing required terms ${expected.requiredTerms.join(", ")}`);
  }
  if (expected.requiredAny?.length && !includesAny(reply, expected.requiredAny)) {
    fail(`${name}: missing any required term from ${expected.requiredAny.join(", ")}`);
  }
  if (expected.forbiddenTerms?.length && includesAny(reply, expected.forbiddenTerms)) {
    fail(`${name}: contains forbidden terms ${expected.forbiddenTerms.join(", ")}`);
  }
  if (expected.maxWords && wordCount(reply) > expected.maxWords) {
    fail(`${name}: expected at most ${expected.maxWords} words, received ${wordCount(reply)}`);
  }
  if (expected.mode && payload?.mode !== expected.mode) {
    fail(`${name}: expected mode=${expected.mode}, received ${payload?.mode}`);
  }
  if (expected.source && payload?.source !== expected.source) {
    fail(`${name}: expected source=${expected.source}, received ${payload?.source}`);
  }
}

function getCases() {
  return [
    {
      name: "Root Place",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What is this place?" }],
        context: { currentPortal: "root" },
      },
      expected: {
        route: "world_awareness",
        fallbackUsed: false,
        context: { currentPortal: "root" },
        requiredAny: ["orientation", "decision", "meet joz", "maxx"],
        forbiddenTerms: ["homepage", "button"],
      },
    },
    {
      name: "Root Choices",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What are my choices here?" }],
        context: {
          currentPortal: "root",
          app_context: {
            available_actions: ["enter_meet_joz", "enter_maxx"],
          },
        },
      },
      expected: {
        route: "world_awareness",
        fallbackUsed: false,
        context: { currentPortal: "root" },
        requiredTerms: ["gold pill", "meet joz", "brain", "maxx"],
      },
    },
    {
      name: "Gold Pill",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What is the Gold Pill?" }],
        context: { currentPortal: "root", currentMesh: "ball" },
      },
      expected: {
        route: "world_awareness",
        concept: "gold_pill",
        fallbackUsed: false,
        context: { currentPortal: "root" },
        requiredTerms: ["meetjoz", "neo/maxx", "skills", "capabilities", "competences", "judgment", "innovation", "ai"],
        requiredAny: ["design", "engineering"],
        forbiddenTerms: ["online communities", "blue pill", "red pill", "harsh realities", "personal fulfilment", "wealth mindset", "social hierarchy", "looksmaxxing advice"],
      },
    },
    {
      name: "Gold Pill In MAXX",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What does the Gold Pill mean in MAXX?" }],
        context: { currentPortal: "maxx", currentMesh: "brain", currentMeshStage: "signal_flow" },
      },
      expected: {
        route: "world_awareness",
        concept: "gold_pill",
        fallbackUsed: false,
        context: { currentPortal: "maxx" },
        requiredTerms: ["human judgment", "ai"],
        requiredAny: ["design", "engineering", "execution", "competitive advantage"],
      },
    },
    {
      name: "Neomaxxing",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What is Neomaxxing?" }],
        context: { currentPortal: "maxx", currentMesh: "brain", currentMeshStage: "signal_flow" },
      },
      expected: {
        route: "world_awareness",
        concept: "neo_maxx",
        fallbackUsed: false,
        context: { currentPortal: "maxx" },
        requiredTerms: ["joz krupa", "neo", "maxx", "ai", "human judgment", "innovation"],
        requiredAny: ["design", "engineering", "computation", "code", "competitive advantage", "neuron metaphor"],
        forbiddenTerms: ["online communities", "lifestyle", "social status", "idealized self", "self-improvement subculture", "physical fitness", "fashion advice"],
      },
    },
    {
      name: "MAXX Scene",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What am I looking at?" }],
        context: { currentPortal: "maxx", currentMesh: "brain", currentMeshStage: "signals_transmitting" },
      },
      expected: {
        route: "world_awareness",
        fallbackUsed: false,
        context: { currentPortal: "maxx" },
        requiredTerms: ["human neuron", "ai neuron", "synapse", "signals"],
        requiredAny: ["new experience", "new pathways"],
      },
    },
    {
      name: "Neuron Click Desktop",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What happens if I click the neuron?" }],
        context: {
          currentPortal: "maxx",
          app_context: {
            current_portal: "maxx",
            focused_object: "maxx_neurons",
            device: { class: "desktop", ar_available: false },
            available_actions: ["pause_sequence", "reveal_neurodesign"],
          },
        },
      },
      expected: {
        route: "world_awareness",
        fallbackUsed: false,
        context: { currentPortal: "maxx", focusedObject: "maxx_neurons", deviceClass: "desktop" },
        requiredTerms: ["desktop", "pauses", "elite beauty"],
        forbiddenTerms: ["camera", "ar"],
      },
    },
    {
      name: "Neuron Click Mobile AR",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What happens if I click the neuron?" }],
        context: {
          currentPortal: "maxx",
          app_context: {
            current_portal: "maxx",
            focused_object: "maxx_neurons",
            device: { class: "mobile", ar_available: true },
            available_actions: ["open_ar"],
          },
        },
      },
      expected: {
        route: "world_awareness",
        fallbackUsed: false,
        context: { currentPortal: "maxx", focusedObject: "maxx_neurons", deviceClass: "mobile" },
        requiredTerms: ["mobile", "ar"],
        requiredAny: ["camera", "n2x.glb", "placed in reality"],
        forbiddenTerms: ["elite beauty", "pause"],
      },
    },
    {
      name: "Meet Joz",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What is Meet Joz?" }],
        context: { currentPortal: "meet-joz", currentMesh: "flex", currentMeshStage: "meet_joz_flex_stage" },
      },
      expected: {
        route: "world_awareness",
        fallbackUsed: false,
        context: { currentPortal: "meet_joz" },
        requiredAny: ["human proof", "capability", "flex", "ascend", "mogg", "skills"],
      },
    },
    {
      name: "Flex",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What is Flex?" }],
        context: { currentPortal: "meet-joz", currentMesh: "flex", currentMeshStage: "meet_joz_flex_stage" },
      },
      expected: {
        route: "world_awareness",
        fallbackUsed: false,
        context: { currentPortal: "meet_joz", currentStage: "meet_joz_flex_stage", focusedObject: "meet_joz_flex" },
        requiredTerms: ["presence", "atmosphere"],
        requiredAny: ["vibe", "arrival", "tone"],
        forbiddenTerms: ["roi", "digital twin", "technical skills"],
      },
    },
    {
      name: "Ascend",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What is Ascend?" }],
        context: { currentPortal: "meet-joz", currentMesh: "ascend", currentMeshStage: "meet_joz_ascend_stage" },
      },
      expected: {
        route: "world_awareness",
        fallbackUsed: false,
        context: { currentPortal: "meet_joz", currentStage: "meet_joz_ascend_stage", focusedObject: "meet_joz_ascend" },
        requiredTerms: ["prestige", "recognition"],
        requiredAny: ["visible proof", "scale", "aura"],
      },
    },
    {
      name: "Mogg",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What is Mogg?" }],
        context: { currentPortal: "meet-joz", currentMesh: "mogg", currentMeshStage: "meet_joz_mogg_stage" },
      },
      expected: {
        route: "world_awareness",
        fallbackUsed: false,
        context: { currentPortal: "meet_joz", currentStage: "meet_joz_mogg_stage", focusedObject: "meet_joz_mogg" },
        requiredTerms: ["digital twin", "identity"],
        forbiddenTerms: ["skills panel", "same as workf"],
      },
    },
    {
      name: "Where Skills",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "Where can I see Joz's skills?" }],
        context: { currentPortal: "meet-joz", currentMesh: "skills", currentMeshStage: "skills_stop" },
      },
      expected: {
        fallbackUsed: false,
        context: { currentPortal: "meet_joz", focusedObject: "meet_joz_mogg" },
        requiredTerms: ["workf"],
        requiredAny: ["skills panel", "jkx-d", "desktop"],
      },
    },
    {
      name: "Worldx",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What is worldx?" }],
        context: { currentPortal: "meet-joz", currentMesh: "flex", currentMeshStage: "meet_joz_flex_stage" },
      },
      expected: {
        route: "world_awareness",
        fallbackUsed: false,
        context: { currentPortal: "meet_joz" },
        requiredTerms: ["abstract gold", "city"],
        requiredAny: ["semantic environment", "proof", "capability", "prestige"],
      },
    },
    {
      name: "Business Value",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "Why should we hire Joz?" }],
        context: { currentPortal: "root", currentMesh: "ball", intentMode: "business_need" },
      },
      expected: {
        mode: "deterministic",
        source: "deterministic_composer",
        fallbackUsed: false,
        requiredTerms: ["agentic ai architecture", "decision intelligence"],
        requiredAny: ["maybank", "mediacorp", "erste", "manulife"],
        maxWords: 55,
      },
    },
    {
      name: "Systems Mindset",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "How does Joz think?" }],
        context: { currentPortal: "root", currentMesh: "brain", intentMode: "systems_mindset" },
      },
      expected: {
        mode: "deterministic",
        source: "deterministic_composer",
        fallbackUsed: false,
        requiredTerms: ["systems"],
        requiredAny: ["signal", "decision", "verification", "action"],
        maxWords: 55,
      },
    },
    {
      name: "Skills Lane",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What is Joz strongest at?" }],
        context: { currentPortal: "meet-joz", currentMesh: "skills", currentMeshStage: "skills_stop", intentMode: "skills" },
      },
      expected: {
        mode: "deterministic",
        source: "deterministic_composer",
        fallbackUsed: false,
        requiredTerms: ["agentic ai architecture"],
        requiredAny: ["retrieval", "orchestration", "observability", "maybank", "mediacorp", "erste", "manulife"],
        maxWords: 55,
      },
    },
    {
      name: "Unknown Term",
      path: "/api/joz-llm",
      body: {
        messages: [{ role: "user", content: "What is quantum banana maxxing?" }],
        context: { currentPortal: "root" },
      },
      expected: {
        forbiddenTerms: ["this is a canonical", "gold pill is", "online communities"],
        requiredAny: ["do not recognize", "don't recognize", "not a canonical", "neo/maxx"],
      },
    },
  ];
}

async function runCase(baseUrl, testCase, timeoutMs) {
  const body = {
    ...testCase.body,
    sessionKey: `${testCase.name.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const syntheticIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
  const payload = await postJson(
    `${baseUrl}${testCase.path}`,
    body,
    timeoutMs,
    { "x-forwarded-for": syntheticIp }
  );
  try {
    assertExpected(payload, testCase);
    console.log(`PASS ${testCase.name}`);
  } catch (error) {
    const reply = String(payload?.reply || "");
    const issue = classifyFailure({ payload, expected: testCase.expected, reply });
    const trace = payload?.trace || {};
    throw new Error(
      [
        `${testCase.name}: ${error.message}`,
        `issue=${issue}`,
        `trace=${JSON.stringify(trace)}`,
        `reply=${JSON.stringify(reply)}`,
      ].join("\n")
    );
  }
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

  console.log(`Checking Joz LLM canonical responses against ${baseUrl}`);
  const cases = getCases();

  for (const testCase of cases) {
    await runCase(baseUrl, testCase, options.timeoutMs);
  }

  console.log(`All ${cases.length} canonical checks passed.`);
}

run().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
