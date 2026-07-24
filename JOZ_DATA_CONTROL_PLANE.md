# Joz data control plane

Joz does not train a foundation model. It owns the data and control plane around interchangeable model providers.

## Runtime architecture

```text
Git / approved connectors
        |
        v
quarantine -> classification -> normalization -> source registry
        |                                      |
        v                                      v
Supabase Storage / object store          Supabase Postgres
        |                         datasets, sources, records,
        |                         ACL metadata, conversations,
        |                         evaluations, audit events
        v
tenant-aware retrieval -> model gateway -> verification -> answer/action audit
```

## Local source of truth

- `data/joz/inbox/`: source text and sidecar metadata
- `data/joz/canonical/`: canonical JSONL knowledge sources
- `data/joz/normalized/`: deterministic generated records
- `data/joz/published/joz-documents.generated.json`: runtime bundle
- `data/joz/published/joz-dataset-manifest.json`: dataset and source registry
- `server/content/`: golden tests and anonymized review fixtures

Run the read-only overview:

```bash
npm run audit:joz-data
```

The command reports both the local bundle and Supabase counts. It never inserts, updates, or deletes data.

The local bundle is an authoring and publish artifact, not an uncontrolled production fallback. In production, Render sets `JOZ_REQUIRE_DATABASE=true`: startup fails without Postgres, local JSON is excluded from runtime retrieval, and file-backed world memory is disabled. Supabase/Postgres is therefore the authoritative runtime store for published records, conversations, evaluations, proposals, and audit events. Local development may set `JOZ_REQUIRE_DATABASE=false` when a non-durable file fallback is intentionally needed.

## Supabase control-plane tables

- `joz_datasets`: one row per dataset and tenant, including schema, owner, classification, retention, checksums, and publish counts.
- `joz_data_sources`: one row per source, including source identity, origin, record counts, evidence tiers, checksum, and publication status.
- `joz_documents`: published records used for retrieval.
- `joz_conversations`, `joz_messages`, `joz_llm_request_events`: operational and audit data.
- `joz_llm_evaluations`, `joz_llm_repair_candidates`: quality review and correction workflow.
- `joz_action_proposals`: durable proposal state with hashed one-time approval/execution tokens.
- `joz_action_events`: append-only lifecycle events for proposal, approval, execution, and verification.

Action tokens are never persisted in plaintext. Proposal records expire, execution is allowlisted, and
database updates use expected-state checks so a second worker cannot approve or execute the same proposal.

The public corpus is dataset `joz-public-knowledge` and tenant `public`. Customer data must use a different dataset and tenant. Retrieval rejects records from another tenant, dataset, or non-public visibility before model context is assembled.

## Publishing

Publishing is explicit:

```bash
npm run build:joz-knowledge
npm run publish:joz-supabase
```

The publish command synchronizes the dataset and source registry before replacing the active public document set. It is an external database mutation and should be run only after reviewing the local manifest.

Secrets belong in Render/environment secret storage. Do not store API keys or database URLs in Git, Supabase data rows, prompts, or retrieved context.
