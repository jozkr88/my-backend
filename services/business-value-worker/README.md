# Business Value Diagnostic Worker

This is the Python service boundary for long-running Business Value work.
The existing Node gateway and 3D experience remain the public product surface.

## Responsibilities

- Extract bounded text from TXT, PDF, and DOCX evidence files.
- Produce unverified evidence candidates with hashes and source references.
- Run the deterministic diagnostic contract behind typed FastAPI endpoints.
- Use LangGraph when installed for an explicit workflow runtime.
- Fall back to the same deterministic workflow for dependency-light tests.

LangChain is intentionally not the authority for diagnosis. It is available for
future model/tool adapters; the evidence gate and verification rules remain
explicit application code.

## Run locally

```bash
cd services/business-value-worker
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

To delegate Business Value runs from the Node gateway, set:

```bash
BUSINESS_VALUE_WORKER_URL=http://127.0.0.1:8000
BUSINESS_VALUE_WORKER_TOKEN=shared-long-random-secret
```

The gateway times out after 15 seconds and falls back to its local diagnostic
kernel if the worker is unavailable.

When a worker token is configured, `/health` remains public for Render health
checks but all `/v1/*` endpoints require the matching bearer token.

For durable LangGraph checkpoints, also set:

```bash
BUSINESS_VALUE_DATABASE_URL=postgresql://user:password@host:5432/database
```

The worker initializes the LangGraph Postgres checkpoint tables on startup and
uses the Business Value case ID as the graph `thread_id`. Without this setting,
the worker reports `langgraph_ephemeral` and the Node/Postgres case store remains
the authoritative persistence layer.

## API

- `GET /health`
- `POST /v1/evidence/extract`
- `POST /v1/diagnostics/{case_id}/run`
- `POST /v1/diagnostics/{case_id}/review`

The worker is stateless at the HTTP boundary, while LangGraph checkpoints are
durable when `BUSINESS_VALUE_DATABASE_URL` is configured. The Node/Postgres case
store remains authoritative for the business case and evidence record; the
LangGraph checkpoint store preserves workflow state by case ID.

Render sets `BUSINESS_VALUE_REQUIRE_DATABASE=true`, so a production worker will
fail startup rather than silently accepting ephemeral checkpoints.
