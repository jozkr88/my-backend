import assert from "node:assert/strict";
import {
  loadPublishedJozKnowledgeGraph,
  queryJozKnowledgeGraph,
} from "../shared/jozKnowledgeGraph.js";

const graph = loadPublishedJozKnowledgeGraph();
const documents = graph.nodes.filter((node) => node.type === "document");
const architectDocuments = documents.filter((document) => (
  String(document.sourceUri || "").includes("causal-intelligence") ||
  String(document.sourceUri || "").includes("causal-ai-chief-architect")
));
const architectSlugs = new Set(architectDocuments.map((document) => document.slug));

assert.ok(architectDocuments.length >= 70, "section corpus should contain at least 70 records");
assert.ok(graph.nodes.some((node) => node.type === "causal_claim"));
assert.ok(graph.nodes.some((node) => node.type === "causal_evidence"));
assert.ok(graph.nodes.some((node) => node.type === "causal_model_version"));

const queries = [
  "How would you design a causal decision operating system?",
  "When is a causal effect identifiable?",
  "Which tools handle causal discovery and refutation?",
  "How should causal evidence and model versions be stored?",
  "How do counterfactuals support enterprise decisions?",
  "What should a chief AI architect build in 90 days?",
];

const results = queries.map((query) => {
  const result = queryJozKnowledgeGraph({ graph, query, limit: 5 });
  assert.ok(
    result.documentSlugs.some((slug) => architectSlugs.has(slug)),
    `causal architect corpus was not retrieved for: ${query}`
  );
  return {
    query,
    retrieved: result.documentSlugs.slice(0, 5),
  };
});

console.log(JSON.stringify({
  graph: { nodes: graph.nodes.length, edges: graph.edges.length },
  architectDocuments: architectDocuments.length,
  queries: results,
}, null, 2));
