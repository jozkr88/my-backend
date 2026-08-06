# Causal Intelligence AI Architecture

Joz's AI architecture is expanding from retrieval and agentic orchestration into
causal intelligence. The semantic knowledge graph stores entities, concepts,
relationships, and provenance. A separate causal engine evaluates whether a
relationship supports identification, intervention, effect estimation,
refutation, or counterfactual reasoning.

The initial causal stack is Neo4j for operational graph storage, NetworkX for
DAG validation, causal-learn for candidate causal discovery, Tigramite for
temporal and lagged discovery, DoWhy-GCM for structural causal models and
counterfactual analysis, and FastAPI as the service boundary.

Causal discovery proposes candidate structures. It does not automatically prove
that an edge is causal. Human and domain review, explicit assumptions, model
versions, data provenance, and refutation results remain part of the causal
claim lifecycle.

