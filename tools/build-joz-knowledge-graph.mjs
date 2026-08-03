import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildJozKnowledgeGraph } from "../shared/jozKnowledgeGraph.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const publishedRoot = path.join(repoRoot, "data", "joz", "published");
const ontologyPath = path.join(publishedRoot, "joz-ontology.generated.json");
const documentsPath = path.join(publishedRoot, "joz-documents.generated.json");
const outputPath = path.join(publishedRoot, "joz-knowledge-graph.generated.json");

const ontology = JSON.parse(fs.readFileSync(ontologyPath, "utf8"));
const published = JSON.parse(fs.readFileSync(documentsPath, "utf8"));
const documents = published.model_ready_records || published.records || [];
const graph = buildJozKnowledgeGraph({ documents, ontology });

fs.writeFileSync(outputPath, `${JSON.stringify(graph, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, nodes: graph.nodes.length, edges: graph.edges.length }, null, 2));
