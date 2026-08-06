# Joz Neo4j setup

The Joz knowledge graph can use Neo4j as its runtime graph backend. The published JSON graph remains the fallback if Neo4j is unavailable.

Configure these backend environment variables:

```text
NEO4J_URI=neo4j+s://<instance>.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=<secret>
NEO4J_DATABASE=neo4j
JOZ_KNOWLEDGE_GRAPH_MODE=shadow
```

Import or refresh the graph after the variables are configured:

```bash
npm run build:joz-knowledge-graph
npm run import:joz-knowledge-graph:neo4j
```

The import is additive. It preserves the existing document, proof, ontology,
and evidence graph while also carrying causal claim metadata such as
`claimStatus`, `relation`, `datasetId`, `modelVersion`, and `confidence`.
Causal assumptions, evidence, datasets, and model versions are imported as
separate graph nodes and relationships, so they can be inspected without
overwriting the current knowledge base.

`shadow` records Neo4j evidence paths without changing answers. Use `augment` only after reviewing graph traces; it adds graph evidence to documents that were already selected by the existing retrieval path.
