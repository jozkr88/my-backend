import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  closeNeo4jJozKnowledgeGraph,
  ensureNeo4jJozKnowledgeGraphSchema,
  importJozKnowledgeGraphToNeo4j,
} from "../shared/neo4jJozKnowledgeGraph.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const graphPath = path.resolve(__dirname, "..", "data", "joz", "published", "joz-knowledge-graph.generated.json");

if (!process.env.NEO4J_URI || !process.env.NEO4J_PASSWORD) {
  throw new Error("NEO4J_URI and NEO4J_PASSWORD are required to import the Joz graph");
}

try {
  const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
  const schema = await ensureNeo4jJozKnowledgeGraphSchema();
  const imported = await importJozKnowledgeGraphToNeo4j({ graph });
  console.log(JSON.stringify({ graphPath, schema, imported }, null, 2));
} finally {
  await closeNeo4jJozKnowledgeGraph();
}
