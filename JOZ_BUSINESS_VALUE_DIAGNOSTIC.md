# Joz Business Value Diagnostic

## Product boundary

The Business Value portal is a diagnostic interface, not a content generator.
It converts a vague AI problem into a bounded working hypothesis, identifies the
evidence required to test it, asks for approval before beginning an assessment,
and only marks a diagnosis verified after sufficient evidence and explicit
confirmation.

The portal's four diagnostic nodes are:

1. **Data Reality** — source of truth, ownership, freshness, and verification.
2. **Control** — approved tools, permissions, ownership, and escalation.
3. **Oversight** — approval, explainability, verification, and rollback.
4. **Adoption** — workflow, user group, trust blocker, and measurable outcome.

## Current implementation

`server/shared/businessValueDiagnostic.js` is the deterministic diagnostic
kernel. It intentionally does not assert that a hypothesis is true. It returns:

- active node
- working hypothesis
- confidence
- evidence coverage
- missing evidence
- approval state
- proposed next action
- node status map

The `/api/joz-llm` response exposes this as `businessValueAgent` and returns a
`businessValueCaseId`. Each Business Value turn is upserted into the case store
and appended to the case event stream. When Postgres is not configured during
local development, the same contract is retained in an in-memory fallback so
the portal remains usable.

`GET /api/business-value/cases/:caseId` returns the current diagnostic state and
ordered event history. The endpoint uses the existing Joz authentication guard;
company-scoped authorization should be tightened when authenticated company
identity is added to the session context.

`POST /api/business-value/cases/:caseId/evidence` accepts a bounded text
document (`title`, `content`, `sourceType`, and optional `sourceRef`) or a
base64 file payload (`fileName`, `mimeType`, and `data`). TXT, Markdown, CSV,
JSON, PDF, and DOCX are supported. The extraction step is deliberately bounded:
it extracts readable text, stores document hashes and matched snippets rather
than the raw file, and marks every candidate `unverified`. Uploaded material
can improve the working hypothesis, but it cannot complete the case until a
separate verification step exists.

`POST /api/business-value/cases/:caseId/evidence/:evidenceKey/review` is that
review boundary. A reviewer can mark a candidate as `claimed`, `corroborated`,
`verified`, or `rejected`; only verified candidates participate in final
diagnosis verification, and the case remains `in_progress` until the required
evidence set has been reviewed.

The 3D portal consumes the state and changes the active node, node glow, status,
and approval/continue action. The action currently resumes the conversational
assessment; it does not claim to connect to enterprise systems yet.

## Target diagnostic graph

```text
open case
  -> observe user problem
  -> frame working hypothesis
  -> retrieve authorized evidence
  -> detect contradictions
  -> ask the smallest useful question
  -> approval checkpoint
  -> update evidence coverage
  -> review diagnosis
  -> propose Joz solution map
  -> define bounded pilot and metric
  -> verify outcome
```

## Reliability rules

- A user statement is a claim, not verified evidence.
- An assistant question never counts as evidence.
- Missing evidence must be explicit.
- Confidence must be calibrated against evidence coverage.
- A diagnosis cannot become `verified` without explicit confirmation.
- Consequential external actions require a separate approval and execution path.
- Every state transition should be replayable from case events.

## Evaluation contract

Each diagnostic case should be scored on:

- node selection accuracy
- root-cause framing quality
- evidence extraction precision
- evidence omission rate
- premature-verification rate
- confidence calibration
- usefulness of the next question
- safety of the proposed action
- agreement with an expert reviewer

The first commercial gate should be a curated set of expert-labelled cases with
ambiguous, contradictory, incomplete, and adversarial inputs. Passing a prose
quality check is not sufficient for charging for the diagnostic.

## Runtime decision

The current app already has a Node/Express gateway, persistence, retrieval,
proposal, and evaluation infrastructure. The diagnostic kernel is therefore
implemented in the existing runtime first. FastAPI/LangGraph should be added
when the workflow needs long-running background jobs, durable interrupts across
workers, or multiple enterprise connectors—not as an additional framework layer
before those requirements are proven. The Python worker is now available behind
`BUSINESS_VALUE_WORKER_URL`; when configured, Business Value diagnostic runs are
delegated to its FastAPI/LangGraph endpoint, with the local kernel retained as
the availability and safety fallback.
