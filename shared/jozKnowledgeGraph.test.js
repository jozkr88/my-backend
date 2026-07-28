import test from "node:test";
import assert from "node:assert/strict";
import {
  buildJozKnowledgeGraph,
  getJozKnowledgeGraphMode,
  queryJozKnowledgeGraph,
} from "./jozKnowledgeGraph.js";

const ontology = {
  capabilities: [
    { id: "agentic_ai", name: "Agentic AI" },
    { id: "knowledge_graphs", name: "Knowledge Graphs" },
  ],
  proofs: [
    {
      id: "marketclue_financial_agents",
      title: "MarketClue Financial Agents",
      company: "MarketClue USA",
      capabilities: ["agentic_ai"],
      source_slugs: ["marketclue-proof"],
      impact_score: 90,
      verification: "cv_supported",
    },
  ],
};

const documents = [
  {
    title: "MarketClue Proof",
    slug: "marketclue-proof",
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

test("knowledge graph traversal returns source documents without changing answer routing", () => {
  const graph = buildJozKnowledgeGraph({ documents, ontology });
  const result = queryJozKnowledgeGraph({
    graph,
    query: "What proves Joz's agentic AI capability?",
  });

  assert.deepEqual(result.matchedNodeIds, ["capability:agentic_ai"]);
  assert.ok(result.documentSlugs.includes("marketclue-proof"));
  assert.ok(result.paths.some((path) => path.edgeTypes.includes("supports")));
});

test("knowledge graph defaults to shadow mode and can be disabled or promoted explicitly", () => {
  assert.equal(getJozKnowledgeGraphMode({}), "shadow");
  assert.equal(getJozKnowledgeGraphMode({ JOZ_KNOWLEDGE_GRAPH_ENABLED: "false" }), "disabled");
  assert.equal(getJozKnowledgeGraphMode({ JOZ_KNOWLEDGE_GRAPH_MODE: "augment" }), "augment");
});

