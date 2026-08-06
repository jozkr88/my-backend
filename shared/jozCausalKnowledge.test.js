import test from "node:test";
import assert from "node:assert/strict";
import {
  buildJozCausalReasoningContext,
  isJozCausalKnowledgeDocument,
  isJozCausalKnowledgeQuestion,
  promoteJozCausalKnowledgeIntent,
} from "./jozCausalKnowledge.js";

test("causal knowledge augmentation is scoped to causal questions", () => {
  assert.equal(isJozCausalKnowledgeQuestion("What is the causal effect of price on demand?"), true);
  assert.equal(isJozCausalKnowledgeQuestion("Tell me about Joz's career."), false);
});

test("causal knowledge documents are recognized without changing ordinary documents", () => {
  assert.equal(isJozCausalKnowledgeDocument({ title: "Causal inference foundations" }), true);
  assert.equal(isJozCausalKnowledgeDocument({ title: "Maybank project proof", body: "Digital sales growth." }), false);
});

test("reasoning context carries causal guardrails and workflow", () => {
  const context = buildJozCausalReasoningContext({ query: "What is counterfactual reasoning?", documents: [{ title: "Counterfactuals", metadata: { slug: "counterfactuals" } }] });
  assert.equal(context.mode, "query_scoped_augment");
  assert.ok(context.workflow.some((item) => /association from causal effect/i.test(item)));
  assert.equal(context.retrievedCausalDocuments[0].slug, "counterfactuals");
});

test("answer-style causal questions are allowed to use open-domain model fallback", () => {
  const promoted = promoteJozCausalKnowledgeIntent({
    input: "What is a collider in a causal graph?",
    classification: {
      kind: "answer",
      domain: "general_knowledge",
      needsClarification: true,
    },
  });
  assert.equal(promoted.domain, "general_knowledge");
  assert.equal(promoted.needsClarification, false);
  assert.equal(promoted.routingOverride, "causal_knowledge_open_domain");
});

test("causal intent promotion does not change execution or refusal classifications", () => {
  const execute = { kind: "execute", domain: "causal", needsClarification: true };
  const refuse = { kind: "refuse", domain: "causal", needsClarification: true };
  assert.deepEqual(
    promoteJozCausalKnowledgeIntent({ input: "Run a causal intervention", classification: execute }),
    execute,
  );
  assert.deepEqual(
    promoteJozCausalKnowledgeIntent({ input: "Refute this causal claim", classification: refuse }),
    refuse,
  );
});
