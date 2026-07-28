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

`shadow` records Neo4j evidence paths without changing answers. Use `augment` only after reviewing graph traces; it adds graph evidence to documents that were already selected by the existing retrieval path.

