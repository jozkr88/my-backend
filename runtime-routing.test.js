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

test("POST /api/joz-llm routes gold pill queries through canonical world awareness", async () => {
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
  assert.equal(payload.mode, "world_awareness");
  assert.equal(payload.trace?.detectedIntent, "world_awareness");
  assert.equal(payload.trace?.detectedConcept, "gold_pill");
  assert.equal(payload.trace?.selectedRoute, "world_awareness");
  assert.equal(payload.trace?.selectedWorldRecord, "root_gold_pill / gold_pill concept");
  assert.equal(payload.trace?.answerSource, "root_gold_pill / gold_pill concept");
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

test("POST /api/joz-llm composes Neomaxxing with deterministic world-aware wording", async () => {
  const { status, payload } = await postJson("/api/joz-llm", {
    sessionKey: "runtime-joz-llm-neomaxxing",
    messages: [{ role: "user", content: "What is Neomaxxing?" }],
    context: {
      currentPortal: "maxx",
      currentMesh: "brain",
      currentMeshStage: "signal_flow",
    },
  });

  const reply = String(payload.reply || "");
  assert.equal(status, 200);
  assert.equal(payload.mode, "world_awareness");
  assert.equal(payload.trace?.detectedConcept, "neo_maxx");
  assert.equal(payload.trace?.selectedWorldRecord, "neo_maxx concept");
  assert.ok(reply.startsWith("Neomaxxing is a concept created by Joz Krupa."));
  assert.match(reply, /\bNEO\b/);
  assert.match(reply, /\bMAXX\b/);
  assert.match(reply, /human judgment/i);
  assert.match(reply, /\bAI\b/i);
  assert.match(reply, /design/i);
  assert.match(reply, /engineering/i);
  assert.match(reply, /computation/i);
  assert.match(reply, /execution/i);
  assert.match(reply, /MAXX portal/i);
  assert.match(reply, /neuron metaphor/i);
  assert.doesNotMatch(reply, /transformative approach/i);
  assert.doesNotMatch(reply, /various domains/i);
  assert.doesNotMatch(reply, /impactful outcomes/i);
  assert.doesNotMatch(reply, /leverage technology/i);
});
