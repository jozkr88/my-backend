import test from "node:test";
import assert from "node:assert/strict";
import app from "./index.js";

const BANNED_GOLD_PILL_TERMS = [
  "online communities",
  "blue pill",
  "red pill",
  "awareness of harsh realities",
  "personal fulfillment",
  "non-traditional methods",
];

async function postJson(pathname, body) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    return { status: response.status, payload };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function assertCanonicalGoldPillReply(reply) {
  assert.ok(
    reply.startsWith("The Gold Pill is a core concept within MeetJoz and NEO/MAXX."),
    `Expected canonical opening, received: ${reply}`
  );

  for (const bannedTerm of BANNED_GOLD_PILL_TERMS) {
    assert.doesNotMatch(reply, new RegExp(bannedTerm, "i"));
  }
}

test("POST /api/joz-llm routes gold pill queries through canonical world concept", async () => {
  const { status, payload } = await postJson("/api/joz-llm", {
    sessionKey: "runtime-joz-llm-gold-pill",
    messages: [{ role: "user", content: "What is the gold pill?" }],
    context: {
      currentPortal: "root",
      currentMesh: "ball",
      currentMeshStage: null,
    },
  });

  assert.equal(status, 200);
  assert.equal(payload.mode, "canonical_world_concept");
  assert.equal(payload.trace?.detectedIntent, "canonical_world_concept");
  assert.equal(payload.trace?.detectedSubIntent, "gold_pill");
  assert.equal(payload.trace?.detectedConcept, "gold_pill");
  assert.equal(payload.trace?.selectedRoute, "canonical_world_concept");
  assert.equal(payload.trace?.selectedWorldRecord, "root_gold_pill / gold_pill concept");
  assert.equal(payload.trace?.answerSource, "root_gold_pill / gold_pill concept");
  assert.equal(payload.trace?.composer, "composeCanonicalWorldConceptReply");
  assert.equal(payload.trace?.fallbackUsed, false);
  assertCanonicalGoldPillReply(String(payload.reply || ""));
});

test("POST /api/agentic preserves canonical world awareness in the live response contract", async () => {
  const { status, payload } = await postJson("/api/agentic", {
    input: "What is the gold pill?",
    context: {
      currentPortal: "root",
      currentMesh: "ball",
      allowedActions: ["brain", "ball"],
      knownInteractiveMeshes: ["brain", "ball"],
    },
  });

  assert.equal(status, 200);
  assert.equal(payload.intent, "world_awareness");
  assert.equal(payload.params?.source, "world_awareness");
  assert.equal(payload.trace?.detectedConcept, "gold_pill");
  assert.equal(payload.trace?.selectedRoute, "world_awareness");
  assert.equal(payload.trace?.selectedWorldRecord, "root_gold_pill / gold_pill concept");
  assertCanonicalGoldPillReply(String(payload.response || ""));
  assertCanonicalGoldPillReply(String(payload.params?.awareness || ""));
});

const JOZ_ROUTER_GATE_CASES = [
  {
    name: "identity_profile",
    body: {
      sessionKey: "runtime-joz-identity",
      messages: [{ role: "user", content: "Who is Joz?" }],
      context: {
        currentPortal: "root",
        currentMesh: "ball",
        currentMeshStage: null,
      },
    },
    expected: {
      detectedIntent: "identity_profile",
      detectedSubIntent: "overview",
      detectedConcept: "joz_identity",
      selectedRoute: "identity_profile",
      answerSource: "JOZ_LLM_CV + JOZ_LLM_IDENTITY",
      composer: "composeIdentityProfileReply",
      fallbackUsed: false,
    },
    text: [/Joz Krupa/i],
  },
  {
    name: "factual_profile.education",
    body: {
      sessionKey: "runtime-joz-education",
      messages: [{ role: "user", content: "Where did Joz study?" }],
      context: {
        currentPortal: "root",
        currentMesh: "ball",
        currentMeshStage: null,
      },
    },
    expected: {
      detectedIntent: "factual_profile",
      detectedSubIntent: "education",
      detectedConcept: "education",
      selectedRoute: "factual_profile",
      answerSource: "JOZ_LLM_CV.education + JOZ_LLM_IDENTITY",
      composer: "composeFactualProfileReply",
      fallbackUsed: false,
    },
    text: [/University of Lancashire/i],
  },
  {
    name: "skills.capabilities_overview",
    body: {
      sessionKey: "runtime-joz-skills",
      messages: [{ role: "user", content: "What can Joz do?" }],
      context: {
        currentPortal: "meet-joz",
        currentMesh: "skills",
        currentMeshStage: "skills_stop",
      },
    },
    expected: {
      detectedIntent: "skills",
      detectedSubIntent: "capabilities_overview",
      detectedConcept: "skills",
      selectedRoute: "skills",
      answerSource: "JOZ_LLM_CV.appliedAiSkills + JOZ_LLM_CV.experience",
      composer: "composeSkillsReply",
      fallbackUsed: false,
    },
    text: [/agentic ai architecture/i],
  },
  {
    name: "systems_mindset",
    body: {
      sessionKey: "runtime-joz-mindset",
      messages: [{ role: "user", content: "How does Joz think?" }],
      context: {
        currentPortal: "root",
        currentMesh: "brain",
        currentMeshStage: null,
      },
    },
    expected: {
      detectedIntent: "systems_mindset",
      detectedSubIntent: "thinking_model",
      detectedConcept: "systems_mindset",
      selectedRoute: "systems_mindset",
      answerSource: "JOZ_LLM_CV.appliedAiSkills + JOZ_LLM_CV.experience",
      composer: "composeSystemsMindsetReply",
      fallbackUsed: false,
    },
    text: [/systems before features|signal from noise/i],
  },
  {
    name: "business_need",
    body: {
      sessionKey: "runtime-joz-business",
      messages: [{ role: "user", content: "Why should we hire Joz?" }],
      context: {
        currentPortal: "root",
        currentMesh: "ball",
        currentMeshStage: null,
      },
    },
    expected: {
      detectedIntent: "business_need",
      detectedSubIntent: "hire_value",
      detectedConcept: "business_value",
      selectedRoute: "business_need",
      answerSource: "JOZ_LLM_CV.experience",
      composer: "composeBusinessNeedReply",
      fallbackUsed: false,
    },
    text: [/Maybank|Mediacorp|Erste Bank|Manulife/i],
  },
  {
    name: "canonical_world_concept.gold_pill",
    body: {
      sessionKey: "runtime-joz-gold-pill-2",
      messages: [{ role: "user", content: "What is the Gold Pill?" }],
      context: {
        currentPortal: "root",
        currentMesh: "ball",
        currentMeshStage: null,
      },
    },
    expected: {
      detectedIntent: "canonical_world_concept",
      detectedSubIntent: "gold_pill",
      detectedConcept: "gold_pill",
      selectedRoute: "canonical_world_concept",
      answerSource: "root_gold_pill / gold_pill concept",
      composer: "composeCanonicalWorldConceptReply",
      fallbackUsed: false,
    },
    text: [/The Gold Pill is a core concept within MeetJoz and NEO\/MAXX\./i],
  },
];

for (const testCase of JOZ_ROUTER_GATE_CASES) {
  test(`POST /api/joz-llm six-query gate: ${testCase.name}`, async () => {
    const { status, payload } = await postJson("/api/joz-llm", testCase.body);

    assert.equal(status, 200);
    assert.equal(payload.trace?.detectedIntent, testCase.expected.detectedIntent);
    assert.equal(payload.trace?.detectedSubIntent, testCase.expected.detectedSubIntent);
    assert.equal(payload.trace?.detectedConcept, testCase.expected.detectedConcept);
    assert.equal(payload.trace?.selectedRoute, testCase.expected.selectedRoute);
    assert.equal(payload.trace?.answerSource, testCase.expected.answerSource);
    assert.equal(payload.trace?.composer, testCase.expected.composer);
    assert.equal(payload.trace?.fallbackUsed, testCase.expected.fallbackUsed);

    for (const matcher of testCase.text) {
      assert.match(String(payload.reply || ""), matcher);
    }

    assert.doesNotMatch(String(payload.reply || ""), /Joz LLM can explain Joz's fit/i);
  });
}
