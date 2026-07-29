import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWorldModelCitationForRecord,
  loadWorldModelKnowledgeRecords,
  validateWorldModelKnowledge,
} from "../shared/worldModelKnowledge.js";
import { rankJozDocumentsForQuery } from "../shared/jozOntology.js";
import { routeJozLlmQuery, composeJozLlmRouteReply } from "../shared/jozLlmRouter.js";

const records = loadWorldModelKnowledgeRecords();
const byId = new Map(records.map((record) => [record.metadata.record_id, record]));

test("validates the v1 dataset, source PDF and page-aware extraction", () => {
  const result = validateWorldModelKnowledge();
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.recordCount, 44);
  assert.equal(result.uniqueIdCount, 44);
  assert.equal(result.pdfPageCount, 16);
  assert.equal(records.length, 56);
});

test("keeps source scopes and record types separate", () => {
  assert.equal(byId.get("wm-paper-001").metadata.claim_scope, "source_grounded");
  assert.equal(byId.get("joz-wm-001").metadata.claim_scope, "joz_verified_report");
  assert.equal(byId.get("joz-wm-012").metadata.claim_scope, "joz_positioning");
  assert.equal(byId.get("joz-wm-009").metadata.claim_scope, "mandatory_boundary");
  assert.equal(byId.get("joz-wm-016").metadata.record_type, "response_policy");
  assert.equal(byId.get("wm-paper-001").metadata.source_pages.join(","), "1,2");
  assert.equal(byId.get("wm-paper-001").metadata.source_publisher, "Stanford HAI");
  assert.ok(records.filter((record) => record.source_type === "stanford_hai_pdf").every((record) => record.metadata.source_pages.length > 0));
});

test("is idempotent and produces stable source-aware identifiers", () => {
  const second = loadWorldModelKnowledgeRecords();
  assert.deepEqual(
    records.map((record) => [record.slug, record.metadata.record_id, record.metadata.source_pages]),
    second.map((record) => [record.slug, record.metadata.record_id, record.metadata.source_pages])
  );
  assert.ok(!records.some((record) => /\/Users\/|SUPABASE|OPENAI_API_KEY|Bearer /i.test(`${record.body} ${JSON.stringify(record.metadata)}`)));
});

test("prioritises boundaries for Joz questions and Stanford for general questions", () => {
  const jozRanked = rankJozDocumentsForQuery(records, {
    intentMode: "skills",
    query: "Is Joz Exocortex a neural world foundation model?",
    limit: 5,
  });
  assert.equal(jozRanked[0].metadata.claim_scope, "mandatory_boundary");

  const generalRanked = rankJozDocumentsForQuery(records, {
    intentMode: "skills",
    query: "What is a world model?",
    limit: 5,
  });
  assert.equal(generalRanked[0].metadata.claim_scope, "source_grounded");
});

const requiredCases = [
  ["What is a world model?", "wm-paper-001"],
  ["How is a world model different from an LLM?", "wm-paper-002"],
  ["How is a world model different from RAG?", "joz-wm-012"],
  ["Are agents obsolete now?", "joz-wm-013"],
  ["What is spatial intelligence?", "wm-paper-003"],
  ["What are renderers, simulators and planners?", "wm-paper-006"],
  ["What is counterfactual reasoning?", "wm-paper-004"],
  ["What is action-conditioned simulation?", "wm-paper-004"],
  ["What is object permanence?", "wm-paper-012"],
  ["What is the simulation-to-reality gap?", "wm-paper-014"],
  ["Why can realistic generated worlds still be wrong?", "wm-paper-013"],
  ["How should world models be evaluated?", "wm-paper-015"],
  ["What is spatial privacy?", "wm-paper-018"],
  ["What should world-model systems log?", "wm-paper-020"],
  ["What is Joz AI Exocortex?", "joz-wm-001"],
  ["Is Joz Exocortex a neural world foundation model?", "joz-wm-009"],
  ["Does Joz Exocortex control live actions?", "joz-wm-010"],
  ["Does it continuously observe the physical world?", "joz-wm-011"],
  ["How does transition learning work?", "joz-wm-005"],
  ["Why does Joz call it an Exocortex?", "joz-wm-014"],
];

for (const [prompt, expectedId] of requiredCases) {
  test(`answers: ${prompt}`, () => {
    const route = routeJozLlmQuery({ input: prompt });
    const resolution = composeJozLlmRouteReply({ route, input: prompt });
    assert.equal(route.selectedRoute, "world_model_knowledge");
    assert.equal(route.selectedWorldRecord, expectedId);
    assert.ok(resolution.reply);
  });
}

const adversarialCases = [
  ["So agents are obsolete now, right?", /agents are not obsolete|world models add/i],
  ["Joz built a DeepMind-style neural world model.", /no|not.*foundation|application-level/i],
  ["The system sees everything through the camera.", /no|structured scene|does not continuously/i],
  ["It autonomously controls the application.", /no|deterministic guardrails/i],
  ["Zero guardrail violations proves it is completely safe.", /no|not proof|depends on/i],
  ["The Stanford paper validates Joz Exocortex.", /external research|does not validate/i],
  ["A realistic generated video must be a valid world model.", /look convincing|not proof|wrong/i],
  ["World-model benchmark scores prove physical safety.", /no|do not.*prove|operational/i],
  ["RAG and world models are the same thing.", /rag retrieves|predicts/i],
  ["Spatial intelligence just means metaverse development.", /no|broader than metaverse/i],
];

for (const [prompt, expected] of adversarialCases) {
  test(`corrects premise: ${prompt}`, () => {
    const route = routeJozLlmQuery({ input: prompt });
    const resolution = composeJozLlmRouteReply({ route, input: prompt });
    assert.match(resolution.reply, expected);
  });
}

test("emits page-aware citation metadata", () => {
  const citation = buildWorldModelCitationForRecord(byId.get("wm-paper-006"));
  assert.deepEqual(citation.pages, [3, 4]);
  assert.equal(citation.publisher, "Stanford HAI");
  assert.match(citation.label, /The World Model/);
});
