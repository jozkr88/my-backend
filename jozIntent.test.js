import test from "node:test";
import assert from "node:assert/strict";

import {
  buildJozAgentPlan,
  buildJozIntentClassification,
  buildJozRiskGateResolution,
  classifyJozIntent,
} from "./shared/jozIntent.js";
import { resolveUnknownJozReply } from "./shared/jozLlmRouter.js";

test("classifies known Joz knowledge routes as low-risk answers", () => {
  const classification = buildJozIntentClassification({
    input: "How does Joz create business value?",
    route: {
      selectedRoute: "business_need",
      detectedSubIntent: "business_help",
    },
  });

  assert.equal(classification.kind, "answer");
  assert.equal(classification.domain, "business");
  assert.equal(classification.risk.level, "low");
  assert.equal(buildJozAgentPlan({ classification }).strategy, "retrieve_then_answer");
});

test("classifies ambiguous open questions for clarification", () => {
  const classification = buildJozIntentClassification({
    input: "How does he do it?",
    route: { selectedRoute: "unknown_fallback" },
  });

  assert.equal(classification.kind, "clarify");
  assert.equal(classification.needsClarification, true);
  assert.equal(buildJozAgentPlan({ classification }).strategy, "ask_clarifying_question");
});

test("gates high-risk execution requests before action", () => {
  const classification = buildJozIntentClassification({
    input: "Deploy this directly to production.",
    route: { selectedRoute: "unknown_fallback" },
  });

  assert.equal(classification.kind, "execute");
  assert.equal(classification.risk.level, "high");
  assert.equal(classification.risk.requiresApproval, true);
  assert.match(
    buildJozRiskGateResolution({ classification }).reply,
    /needs explicit approval/i
  );
});

test("uses the semantic classifier for an open-ended question", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";

  try {
    const classification = await classifyJozIntent({
      openai: {
        chat: {
          completions: {
            create: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      kind: "answer",
                      domain: "general_knowledge",
                      goal: "explain_quantum_computing",
                      entities: ["quantum computing"],
                      confidence: 0.93,
                      risk: { level: "low", requiresApproval: false, reasons: [] },
                    }),
                  },
                },
              ],
            }),
          },
        },
      },
      input: "What is quantum computing?",
      route: { selectedRoute: "unknown_fallback" },
    });

    assert.equal(classification.source, "model");
    assert.equal(classification.domain, "general_knowledge");
    assert.equal(classification.goal, "explain_quantum_computing");
    assert.equal(classification.confidenceBand, "high");
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("allows an open-domain question to reach the model instead of a scope boundary", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";

  try {
    const resolution = await resolveUnknownJozReply({
      input: "What is distributed quantum cognition?",
      messages: [{ role: "user", content: "What is distributed quantum cognition?" }],
      openai: {
        chat: {
          completions: {
            create: async () => ({
              choices: [{ message: { content: "It is a speculative concept." } }],
            }),
          },
        },
      },
      intentClassification: {
        kind: "answer",
        domain: "general_knowledge",
      },
      roleAwareContext: { retrievedDocuments: [] },
    });

    assert.equal(resolution.answerSource, "openai_model");
    assert.match(resolution.reply, /speculative concept/i);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
