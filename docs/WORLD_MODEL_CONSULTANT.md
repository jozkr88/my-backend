# World Model Consultant

World Model Consultant is an additive consulting workflow inside Meet Joz. It does not replace Joz MAXX, the World Model trajectory, Skills/Neurons portals, or AR delivery.

## Current vertical slice

```text
/consultant
  → guided discovery
  → normalized company profile
  → deterministic maturity and opportunity scoring
  → free opportunity assessment
  → consulting lead
```

The existing Joz MAXX Business Value lane opens `/consultant`. The default site route and all existing `/neo/*`, `/space/*`, `/world-model`, and `/joz-llm-dashboard` routes remain available.

## Contracts

`shared/worldModelConsultant.js` owns the MVP contract:

- eight focused discovery fields;
- profile normalization and validation;
- opportunity factor weights;
- world-model qualification signals;
- evidence, assumptions, confidence, and directional maturity scoring.

The browser collects answers. The server validates and scores them. An LLM may later improve follow-up wording and report drafting, but must not replace the deterministic validation, scoring, payment, authorization, or versioning boundaries.

## Persistence

When PostgreSQL/Supabase is configured, `db.js` creates:

- `joz_consultant_assessments`;
- `joz_consultant_assessment_messages`;
- `joz_consultant_leads`.

Without a database, development uses process memory. Render deployments should therefore configure `DATABASE_URL` or `SUPABASE_DB_URL` before treating assessment persistence as production-ready.

## Deliberate limitations of this increment

- Stripe Checkout and webhook verification are not enabled yet.
- The detailed paid report and PDF renderer are not enabled yet.
- Authentication is not yet present; the MVP uses a browser session key plus UUID assessment ID.
- The free analysis is deterministic and directional; it does not claim to be an enterprise predictive world model.

The next vertical slice should add authenticated ownership, Stripe test mode with an idempotent webhook, immutable report versions, and a print-friendly HTML/PDF report using the same assessment ID.
