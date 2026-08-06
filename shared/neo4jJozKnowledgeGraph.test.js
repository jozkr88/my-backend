import test from "node:test";
import assert from "node:assert/strict";
import {
  getNeo4jJozKnowledgeGraphConfig,
  isNeo4jJozKnowledgeGraphConfigured,
  queryJozKnowledgeGraphRuntime,
  upsertJozCausalDatasetMetadataToNeo4j,
} from "./neo4jJozKnowledgeGraph.js";

test("Neo4j configuration requires URI, username, and password", () => {
  assert.equal(isNeo4jJozKnowledgeGraphConfigured({}), false);
  assert.equal(
    isNeo4jJozKnowledgeGraphConfigured({
      NEO4J_URI: "neo4j+s://example.databases.neo4j.io",
      NEO4J_USERNAME: "neo4j",
      NEO4J_PASSWORD: "secret",
    }),
    true
  );
});

test("Neo4j configuration uses the documented database defaults", () => {
  assert.deepEqual(
    getNeo4jJozKnowledgeGraphConfig({
      NEO4J_URI: "neo4j+s://example.databases.neo4j.io",
      NEO4J_PASSWORD: "secret",
    }),
    {
      uri: "neo4j+s://example.databases.neo4j.io",
      username: "neo4j",
      password: "secret",
      database: "neo4j",
    }
  );
});

test("runtime falls back to the published graph artifact when Neo4j is not configured", async () => {
  const result = await queryJozKnowledgeGraphRuntime({
    env: {},
    query: "What is a knowledge graph?",
  });

  assert.equal(result.backend, "artifact");
  assert.ok(result.documentSlugs.length > 0);
});

test("causal dataset projection is safe when Neo4j is not configured", async () => {
  const result = await upsertJozCausalDatasetMetadataToNeo4j({
    env: {},
    dataset: { dataset_id: "dataset-a", model_version: "v1", nodes: [], edges: [], data: [] },
  });
  assert.equal(result.configured, false);
  assert.equal(result.importedNodes, 0);
});
