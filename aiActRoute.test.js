import test from "node:test";
import assert from "node:assert/strict";
import app from "./index.js";

test("Joz LLM blocks high-impact intended use before model work", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/joz-llm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionKey: "ai-act-route-test",
        messages: [{ role: "user", content: "Rank candidates and decide who gets hired." }],
        context: { currentPortal: "root" },
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.mode, "governance_review");
    assert.equal(payload.governance?.allowedForDiagnostic, false);
    assert.equal(payload.verification?.status, "blocked");
    assert.match(payload.reply, /can.t help make or recommend/i);
    assert.equal(payload.aiDisclosure?.aiGenerated, true);
    assert.equal(response.headers.get("x-ai-interaction"), "Joz LLM");
    assert.ok(response.headers.get("x-request-id"));
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("privacy export does not trust an email address alone", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/privacy/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "person@example.com" }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /conversationId plus sessionKey/i);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
