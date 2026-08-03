import test from "node:test";
import assert from "node:assert/strict";
import {
  buildJozKnowledgeGraph,
  getJozKnowledgeGraphMode,
  loadPublishedJozKnowledgeGraph,
  queryJozKnowledgeGraph,
} from "./jozKnowledgeGraph.js";

const ontology = {
  capabilities: [
    { id: "agentic_ai", name: "Agentic AI" },
    { id: "knowledge_graphs", name: "Knowledge Graphs" },
  ],
  proofs: [
    {
      id: "mc_usa_financial_agents",
      title: "MC USA Financial Agents",
      company: "MC USA",
      capabilities: ["agentic_ai"],
      source_slugs: ["mc-usa-proof"],
      impact_score: 90,
      verification: "cv_supported",
    },
  ],
};

const documents = [
  {
    title: "MC USA Proof",
    slug: "mc-usa-proof",
    category: "proof",
    summary: "Financial AI agents with live data and portfolios.",
    metadata: {
      capabilities: ["agentic_ai"],
      verification_status: "cv_supported",
      impact_score: 90,
    },
  },
  {
    title: "Knowledge Graph Architecture",
    slug: "knowledge-graph-architecture",
    category: "skills",
    metadata: {
      capabilities: ["knowledge_graphs"],
      verification_status: "verified",
      impact_score: 70,
    },
  },
];

test("knowledge graph builder preserves evidence relationships", () => {
  const graph = buildJozKnowledgeGraph({ documents, ontology });

  assert.equal(graph.schema, "joz.knowledge-graph.v1");
  assert.ok(graph.nodes.some((node) => node.id === "person:jozef_krupa"));
  assert.ok(graph.edges.some((edge) => edge.type === "has_proof"));
  assert.ok(graph.edges.some((edge) => edge.type === "supported_by"));
  assert.ok(graph.edges.some((edge) => edge.type === "supports"));
});

test("document nodes retain resolvable source provenance", () => {
  const graph = buildJozKnowledgeGraph({
    documents: [{
      ...documents[0],
      source_uri: "data/joz/canonical/example.jsonl#record-1",
      metadata: {
        ...documents[0].metadata,
        source_filename: "example.jsonl",
        source_meta_filename: "example.meta.json",
        source_checksum: "checksum-1",
        evidence_tier: "verified_fact",
      },
    }, documents[1]],
    ontology,
  });
  const canonical = graph.nodes.find((node) => node.slug === "mc-usa-proof");
  const inbox = graph.nodes.find((node) => node.slug === "knowledge-graph-architecture");

  assert.deepEqual(
    {
      sourceFilename: canonical.sourceFilename,
      sourceMetaFilename: canonical.sourceMetaFilename,
      sourceUri: canonical.sourceUri,
      sourcePath: canonical.sourcePath,
      sourceChecksum: canonical.sourceChecksum,
      evidenceTier: canonical.evidenceTier,
    },
    {
      sourceFilename: "example.jsonl",
      sourceMetaFilename: "example.meta.json",
      sourceUri: "data/joz/canonical/example.jsonl#record-1",
      sourcePath: "data/joz/canonical/example.jsonl#record-1",
      sourceChecksum: "checksum-1",
      evidenceTier: "verified_fact",
    }
  );
  assert.equal(inbox.sourcePath, null);
});

test("published graph has source-backed proof evidence paths", () => {
  const published = loadPublishedJozKnowledgeGraph();
  const nodes = new Map(published.nodes.map((node) => [node.id, node]));
  const documents = published.nodes.filter((node) => node.type === "document");
  const supportedBy = published.edges.filter((edge) => edge.type === "supported_by");

  assert.equal(documents.length, 160);
  assert.ok(documents.every((document) => document.sourcePath && document.sourceChecksum));
  assert.equal(supportedBy.length, 29);
  assert.ok(supportedBy.every((edge) => {
    const proof = nodes.get(edge.from);
    const document = nodes.get(edge.to);
    return proof?.type === "proof" && document?.type === "document" && document.sourcePath;
  }));
});

test("knowledge graph traversal returns source documents without changing answer routing", () => {
  const graph = buildJozKnowledgeGraph({ documents, ontology });
  const result = queryJozKnowledgeGraph({
    graph,
    query: "What proves Joz's agentic AI capability?",
  });

  assert.deepEqual(result.matchedNodeIds, ["capability:agentic_ai"]);
  assert.ok(result.documentSlugs.includes("mc-usa-proof"));
  assert.ok(result.paths.some((path) => path.edgeTypes.includes("supports")));
});

test("knowledge graph defaults to shadow mode and can be disabled or promoted explicitly", () => {
  assert.equal(getJozKnowledgeGraphMode({}), "shadow");
  assert.equal(getJozKnowledgeGraphMode({ JOZ_KNOWLEDGE_GRAPH_ENABLED: "false" }), "disabled");
  assert.equal(getJozKnowledgeGraphMode({ JOZ_KNOWLEDGE_GRAPH_MODE: "augment" }), "augment");
});
