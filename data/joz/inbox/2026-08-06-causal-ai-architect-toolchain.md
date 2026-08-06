Recommended tool categories
Purpose	Tools	Best use
Visual causal modelling	DAGitty	Manually draw DAGs, identify confounders and examine adjustment sets
Ontology engineering	Protégé / WebProtégé	Define enterprise concepts, causal relation types and OWL ontologies
Causal discovery	causal-learn, Tetrad, Tigramite	Propose causal structures from observational or time-series data
Causal inference	DoWhy	Identification, effect estimation, assumption testing and refutation
Counterfactuals and root cause	DoWhy-GCM	Structural causal models, interventions, counterfactuals and anomaly attribution
Heterogeneous effects	EconML	Estimate how interventions affect different customers, assets or operational segments
Bayesian causal modelling	pgmpy	Bayesian networks, structural learning, probabilistic inference and do() queries
Graph prototyping	NetworkX	DAG validation, ancestors, descendants, cycles and topological operations
Production property graph	Neo4j	Operational storage, traversal, Cypher querying and application integration
Semantic knowledge graph	GraphDB or Stardog	RDF, SPARQL, ontology reasoning and enterprise semantic integration
RDF development	RDFLib	Create, transform and query RDF graphs in Python
Graph validation	SHACL	Enforce structural and semantic constraints on RDF knowledge graphs
Visual exploration	Neo4j Bloom	Let analysts explore stored entities and relationships visually

DAGitty is specifically designed for creating and analysing causal DAGs. Protégé supports OWL ontology development and collaborative WebProtégé editing.

For data-driven discovery, causal-learn provides Python implementations of causal discovery algorithms, while Tigramite is particularly useful for high-dimensional time-series data and lagged causal relationships. Causal discovery should generate candidate structures rather than automatically declaring relationships to be proven causes; the results still need assumptions, domain constraints and validation.

For the executable causal layer, DoWhy is the strongest general starting point. It models assumptions explicitly and supports identification, estimation and refutation. Its graphical causal model functionality adds counterfactual analysis, causal-strength estimation and root-cause attribution. EconML complements it when you need individual or segment-level treatment effects.

pgmpy is useful when the system must combine causal and probabilistic reasoning—for example, calculating downstream probability distributions after an intervention or working with discrete, Gaussian or dynamic Bayesian networks.

The stack I would recommend for you

Given your Python, FastAPI and agentic-system background:

Data sources
    ↓
PostgreSQL / Parquet / event streams
    ↓
causal-learn or Tigramite
Candidate causal discovery
    ↓
Human and domain-expert review
    ↓
DoWhy / DoWhy-GCM
Identification, estimation, refutation and counterfactuals
    ↓
Neo4j
Versioned causal knowledge graph
    ↓
FastAPI causal-query service
    ↓
Agentic decision and simulation layer

Neo4j is a practical choice for the operational graph because its property-graph model supports nodes and typed relationships, while its Graph Data Science library provides DAG, path, similarity and machine-learning functionality. Bloom provides visual exploration. Neo4j itself, however, is the storage and graph-computation layer, not the statistical proof that an edge is causal.

A simple relationship might look like:

(:Variable {name: "Price"})
-[:CAUSES {
    sign: "negative",
    lag: "7d",
    confidence: 0.84,
    status: "experimentally_supported",
    model_version: "v12",
    valid_from: "2026-01-01"
}]->
(:Variable {name: "Demand"})

But avoid putting all evidence into the relationship itself. Model evidence as first-class nodes:

(Variable)-[:CAUSES]->(Variable)
                    |
                    [:SUPPORTED_BY]
                    ↓
             (Experiment)

Experiment → Dataset
Experiment → Estimator
Experiment → AssumptionSet
Experiment → RefutationResult
Experiment → ModelVersion

This gives you provenance, auditability and the ability to distinguish:

HYPOTHESIZED_CAUSE
DISCOVERED_ASSOCIATION
SUPPORTED_CAUSE
REFUTED_CAUSE
CONTEXT_DEPENDENT_CAUSE
When to choose RDF instead

Use GraphDB or Stardog with RDF/OWL/SHACL rather than Neo4j when you need formal enterprise semantics, ontology interoperability, logical inference, globally unique identifiers or strict graph validation. GraphDB and Stardog both support RDF reasoning; SHACL formally validates RDF graphs against defined structural conditions.

A strong semantic stack would be:

Protégé
    ↓ OWL ontology
RDFLib
    ↓ RDF ingestion
GraphDB or Stardog
    ↓ SPARQL + reasoning
SHACL
    ↓ validation
DoWhy service
    ↓ causal computation
Enterprise applications and agents
Best starting combination

For an initial working causal decision platform, I would select:

Neo4j + DoWhy-GCM + causal-learn + Tigramite + NetworkX + FastAPI

Add Protégé, RDF and SHACL later when the graph must become a shared enterprise ontology across departments, systems and organisations. The essential design principle is to keep the knowledge graph, causal model, supporting evidence and model versions connected—but not collapsed into one undifferentiated graph.
