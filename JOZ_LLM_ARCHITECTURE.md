## Joz LLM Architecture

This is the first production-oriented architecture for `Joz LLM` using:

- `Render` for the app and orchestration layer
- `Supabase` for Postgres, storage, and retrieval-backed knowledge
- optional `Redis` later for hot session memory, caching, and queues

## Transformer model boundary

Joz uses a provider-agnostic model gateway around a decoder-only transformer. The default is a hosted OpenAI-compatible model, but the same control plane can route to a private transformer served by vLLM or TGI through an OpenAI-compatible `/chat/completions` endpoint.

The transformer is responsible for language understanding and generation. Joz remains responsible for intent classification, Supabase retrieval, tenant/data permissions, risk gates, approvals, tool allowlists, verification, audit events, and uncertainty escalation. Changing the model provider must not bypass those controls.

Configure the model boundary with:

```env
JOZ_MODEL_PROVIDER=openai
JOZ_MODEL=gpt-4o-mini
# or:
# JOZ_MODEL_PROVIDER=self_hosted_transformer
# JOZ_TRANSFORMER_BASE_URL=http://transformer.internal/v1
# JOZ_TRANSFORMER_MODEL=your-model-id
```

The runtime exposes the selected provider, model, transformer architecture, availability, and `joz-control-plane` data boundary through `/api/version` and the LLM response trace.

### System shape

1. `UI layer`
   - React voice/chat interface
   - quick actions like `Business Need`, `Mindset`, `Skills`, `Book Joz`

2. `Orchestration layer`
   - Express backend on Render
   - intent detection
   - persona control
   - retrieval composition
   - lead capture and booking actions

3. `Knowledge layer`
   - `joz_profiles`
   - `joz_documents`
   - `joz_document_chunks`
   - optional embeddings in `joz_document_chunks.embedding`

4. `Conversation layer`
   - `joz_conversations`
   - `joz_messages`

5. `Business action layer`
   - `joz_business_leads`
   - `joz_booking_requests`

### Request flow

1. The user sends a message from the popup.
2. The Render backend classifies the user intent:
   - `business_need`
   - `recruiter_fit`
   - `mindset`
   - `skills`
   - `booking`
3. The backend loads the primary profile from `joz_profiles`.
4. Relevant knowledge is retrieved from `joz_documents` and `joz_document_chunks`.
5. A Joz-specific system prompt is composed with:
   - persona rules
   - current user intent
   - retrieved evidence
   - conversation history
6. The model response is generated.
7. The user and assistant messages are persisted.
8. If the message expresses hiring or business intent, a structured record is written to:
   - `joz_business_leads`, or
   - `joz_booking_requests`

### Recommended document categories

- `bio`
- `skills`
- `case_study`
- `mindset`
- `service`
- `proof`
- `faq`

### What to build next

1. Replace the current role-specific Joz LLM prompt with a generic Joz agent prompt.
2. Add an ingestion script that converts source content into `joz_documents`.
3. Add chunking + embedding generation for `joz_document_chunks`.
4. Update `/api/joz-llm` to retrieve Joz documents from Supabase instead of relying only on static in-code profile data.
5. Persist conversations and leads in the new tables.

### Redis later, not now

Add Redis only when one of these becomes real:

- low-latency session memory
- cached retrieval/model outputs
- rate limiting
- background task queues
- multi-step async agent workflows

## Causal decision intelligence boundary

Joz keeps semantic retrieval and causal computation separate. The semantic
knowledge graph may store entities, concepts, evidence, and candidate
relationships, but it must not promote a relationship to a proven cause on
its own.

The causal service lives outside the Node/Express runtime and is feature
flagged through `JOZ_CAUSAL_MODE`:

```text
JOZ_CAUSAL_MODE=disabled|shadow|augment|decision_support
JOZ_CAUSAL_SERVICE_URL=http://127.0.0.1:8010
```

The initial service stack is:

- Neo4j for operational graph storage
- NetworkX for DAG validation and graph operations
- causal-learn for candidate causal discovery
- Tigramite for temporal and lagged discovery
- DoWhy-GCM for structural causal models, interventions, refutation, and
  counterfactual analysis
- FastAPI as the service boundary

Discovery tools produce hypotheses. Only versioned, evidence-backed models
with explicit assumptions may produce causal claims. The computational causal
service remains feature-flagged, while the published causal knowledge corpus
is now added to Joz MAXX context selectively for causal questions.

### Causal knowledge response augmentation

When a question contains causal concepts such as intervention, counterfactual,
identification, mechanism, confounding, treatment effect, or refutation, the
runtime adds the relevant causal documents and a bounded reasoning workflow to
the answer context. The workflow instructs Joz to separate association from
causation, state assumptions, use evidence strength and model versions, and
label conceptual knowledge versus empirical evidence. Ordinary questions do
not receive this additional context.

### Slice 1 causal tool registry

The first application-owned causal tools are implemented in
`shared/jozCausalToolRegistry.js`:

- `get_causal_neighbourhood`
- `explain_causal_path`
- `inspect_causal_claim`
- `estimate_causal_effect`
- `run_counterfactual`
- `refute_causal_structure`

They use strict argument validation and return structured, version-scoped
results with statuses, evidence strength, assumptions, model versions, and
warnings. They are read-only and operate against the published graph artifact.
When causal mode is enabled, the runtime can select at most one of these tools
from the bounded published-graph catalog. The model may only emit one of the
registered schemas; the application validates the tool name and arguments
again before execution. An internal typed `context.causalToolRequest` can also
request a tool for controlled callers, but it is still validated by the same
registry.

Shadow mode removes both causal analysis and causal-tool results from model
context, so the existing answer path cannot change. `augment` and
`decision_support` explicitly opt into passing the structured result to the
answer context. Tool selection remains read-only in this slice; authorization,
dataset scoping, and run persistence are enforced around execution. PostgreSQL
records authorized and completed runs in `joz_causal_tool_runs` when the
database is enabled; local development keeps the structured run in the
response trace. `estimate_causal_effect` is the first computational tool. It
requires an explicit treatment, outcome, treatment/control values, versioned
DAG, and observed tabular dataset supplied through the authorized causal
runtime context. The service returns an average treatment effect with
uncertainty, distribution summaries, graph validation, and assumptions.
Missing data is a structured `data_required` result rather than an invented
estimate. `run_counterfactual` uses a factual observation plus an explicit
intervention and returns the factual value, counterfactual value, delta, and
assumptions. It labels single-unit uncertainty as not estimated. Refutation
uses edge-dependence and local-Markov tests with false-discovery-rate
adjustment. It returns `refuted` or `not_refuted`; a non-rejected graph is not
proof of causality.

The causal knowledge expansion is additive: the existing Joz knowledge base
remains the default corpus, while AI-architecture, causal decision-operating
system, and causal-governance datasets are published with explicit dataset and
model-version identifiers. The graph stores their claims, assumptions, and
evidence as first-class nodes. Neo4j can therefore provide causal context and
provenance without replacing the current semantic retrieval layer.

Computational causal datasets use the separate `joz.causal-dataset.v1`
contract. The gateway validates dataset and model identity, tenant scope,
acyclic graph structure, numeric columns, minimum row count, and a content
checksum before forwarding data to the causal service. The controlled
`publish:causal-dataset` command stores dataset metadata, versioned graph,
variables, observations, and lifecycle status in PostgreSQL. Runtime tools
resolve only `published` versions by dataset ID and model version.

The same lifecycle is available through authenticated management routes:
`POST /api/causal/datasets/validate`, `POST /api/causal/datasets/publish`,
`GET /api/causal/datasets`, and
`GET /api/causal/datasets/:datasetId/versions/:modelVersion`. The read route
returns metadata by default; observation payloads require an explicit
`includeData=true` request.
