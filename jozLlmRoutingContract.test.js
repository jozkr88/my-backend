import test from "node:test";
import assert from "node:assert/strict";
import app from "./index.js";

async function postJson(pathname, body) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
      },
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

const ROUTING_CASES = [
  {
    name: "education question routes to factual_profile.education",
    query: "Where did Joz study?",
    context: { currentPortal: "root" },
    expectedIntent: "factual_profile",
    expectedSubIntent: "education",
    expectedRoute: "factual_profile",
    requiredTerms: ["University of Lancashire", "United Kingdom", "Strategy and Innovation", "2008"],
    forbiddenTerms: ["strongest skills", "Agentic AI architecture", "Maybank", "Mediacorp"],
  },
  {
    name: "degree question routes to factual_profile.education",
    query: "What degree does Joz have?",
    context: { currentPortal: "root" },
    expectedIntent: "factual_profile",
    expectedSubIntent: "education",
    expectedRoute: "factual_profile",
  },
  {
    name: "certifications question routes to factual_profile.certifications",
    query: "What certifications does Joz have?",
    context: { currentPortal: "root" },
    expectedIntent: "factual_profile",
    expectedSubIntent: "certifications",
    expectedRoute: "factual_profile",
  },
  {
    name: "contact question routes to factual_profile.contact",
    query: "How can I contact Joz?",
    context: { currentPortal: "root" },
    expectedIntent: "factual_profile",
    expectedSubIntent: "contact",
    expectedRoute: "factual_profile",
  },
  {
    name: "location question routes to factual_profile.location",
    query: "Where is Joz based?",
    context: { currentPortal: "root" },
    expectedIntent: "factual_profile",
    expectedSubIntent: "location",
    expectedRoute: "factual_profile",
  },
  {
    name: "skills question routes to skills",
    query: "What is Joz strongest at?",
    context: { currentPortal: "meet-joz", currentMesh: "skills", currentMeshStage: "skills_stop" },
    expectedIntent: "skills",
    expectedRoute: "skills",
    requiredTerms: ["Maybank", "Mediacorp", "Erste", "Manulife", "agentic AI architecture"],
  },
  {
    name: "business question routes to business_need",
    query: "Why should we hire Joz?",
    context: { currentPortal: "root" },
    expectedIntent: "business_need",
    expectedRoute: "business_need",
  },
  {
    name: "mindset question routes to systems_mindset",
    query: "How does Joz think?",
    context: { currentPortal: "root" },
    expectedIntent: "systems_mindset",
    expectedRoute: "systems_mindset",
  },
  {
    name: "gold pill question routes to canonical concept",
    query: "What is the Gold Pill?",
    context: { currentPortal: "root", currentMesh: "ball" },
    expectedIntent: "canonical_world_concept",
    expectedConcept: "gold_pill",
    expectedRoute: "canonical_world_concept",
  },
  {
    name: "neomaxxing question routes to canonical concept",
    query: "What is Neomaxxing?",
    context: { currentPortal: "maxx", currentMesh: "brain", currentMeshStage: "signal_flow" },
    expectedIntent: "canonical_world_concept",
    expectedConcept: "neo_maxx",
    expectedRoute: "canonical_world_concept",
  },
  {
    name: "mogg question routes to canonical concept",
    query: "What is Mogg?",
    context: { currentPortal: "meet-joz", currentMesh: "mogg", currentMeshStage: "meet_joz_mogg_stage" },
    expectedIntent: "canonical_world_concept",
    expectedConcept: "meet_joz_mogg",
    expectedRoute: "canonical_world_concept",
  },
  {
    name: "maxx viewing question routes to world_awareness",
    query: "What am I looking at?",
    context: { currentPortal: "maxx", currentMesh: "brain", currentMeshStage: "signals_transmitting" },
    expectedIntent: "world_awareness",
    expectedRoute: "world_awareness",
  },
];

for (const testCase of ROUTING_CASES) {
  test(`POST /api/joz-llm ${testCase.name}`, async () => {
    const { status, payload } = await postJson("/api/joz-llm", {
      sessionKey: `contract-${testCase.name}`,
      messages: [{ role: "user", content: testCase.query }],
      context: testCase.context,
    });

    const reply = String(payload.reply || "");
    assert.equal(status, 200);
    assert.equal(payload.trace?.detectedIntent, testCase.expectedIntent);
    assert.equal(payload.trace?.selectedRoute, testCase.expectedRoute);
    if (testCase.expectedSubIntent) {
      assert.equal(payload.trace?.detectedSubIntent, testCase.expectedSubIntent);
    }
    if (testCase.expectedConcept) {
      assert.equal(payload.trace?.detectedConcept, testCase.expectedConcept);
    }
    for (const term of testCase.requiredTerms || []) {
      assert.ok(reply.toLowerCase().includes(String(term).toLowerCase()), `Expected reply to include ${term}, received: ${reply}`);
    }
    for (const term of testCase.forbiddenTerms || []) {
      assert.doesNotMatch(reply, new RegExp(term, "i"));
    }
  });
}

test("POST /api/agentic preserves canonical world awareness for the voice endpoint", async () => {
  const { status, payload } = await postJson("/api/agentic", {
    input: "What is the Gold Pill?",
    context: {
      currentPortal: "root",
      currentMesh: "ball",
      allowedActions: ["brain", "ball"],
      knownInteractiveMeshes: ["brain", "ball"],
    },
  });

  assert.equal(status, 200);
  assert.equal(payload.intent, "world_awareness");
  assert.equal(payload.trace?.detectedConcept, "gold_pill");
  assert.equal(payload.trace?.selectedRoute, "world_awareness");
});
