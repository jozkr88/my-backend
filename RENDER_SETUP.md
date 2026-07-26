# Render Backend Setup

This backend is ready to run on Render as a Node web service from the [`server/`](</Users/jozzox/Downloads/xq/server>) directory.

## Blueprint option

Use the root [`render.yaml`](</Users/jozzox/Downloads/xq/render.yaml>) file to create the web service.

## Manual Render settings

- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/api/hello`

## Required environment variables

```env
OPENAI_API_KEY=...
JOZ_MODEL_PROVIDER=openai
JOZ_MODEL=gpt-4o-mini
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
JOZ_REQUIRE_AUTH=true
JOZ_REQUIRE_DATABASE=true
DISABLE_FILE_MEMORY=1
STRIPE_SECRET_KEY=sk_test_... # use the live key in production
JOZ_ARCHITECTURE_REVIEW_PRICE_CENTS=250000
JOZ_ARCHITECTURE_REVIEW_CURRENCY=usd
JOZ_PUBLIC_APP_URL=https://your-public-app.example
JOZ_ALLOWED_ORIGINS=https://meetjoz.com,https://www.meetjoz.com
```

Notes:

- `DATABASE_URL` is preferred on Render. The backend also accepts `SUPABASE_DB_URL`.
- `JOZ_MODEL_PROVIDER=openai` is the default hosted transformer path. For a self-hosted transformer, use `JOZ_MODEL_PROVIDER=self_hosted_transformer`, set `JOZ_TRANSFORMER_BASE_URL` to an internal OpenAI-compatible vLLM/TGI endpoint, and set `JOZ_TRANSFORMER_MODEL` to the served model ID. Keep that endpoint private and reachable only by the backend.
- `SUPABASE_URL` enables Supabase Auth JWT verification through the project's JWKS endpoint. The backend requires a valid JWT for proposal approval and execution when `JOZ_REQUIRE_AUTH=true`.
- `JOZ_ALLOWED_ORIGINS` is a comma-separated production CORS allowlist. Keep it limited to the deployed frontend origins; do not use `*` in production.
- `JOZ_REQUIRE_DATABASE=true` makes Supabase/Postgres mandatory. The service fails during startup if the database is unavailable or not configured, and it does not fall back to local JSON or process memory for runtime data.
- `DISABLE_FILE_MEMORY=1` disables `worldMemory.json` writes because Render web services do not provide durable local disk storage across restarts/deploys.
- The checked-in `data/joz/published/` files are build and publishing artifacts. They are visible in the data-control overview, but production retrieval is database-backed when `JOZ_REQUIRE_DATABASE=true`.
- The paid architecture flow is chat-native: it collects the brief, shows the draft scope, and starts Stripe Checkout from the chat. Keep `STRIPE_SECRET_KEY` server-side; the price is configured in minor currency units (for example, `250000` is USD 2,500.00). `JOZ_PUBLIC_APP_URL` is used for the success and cancellation return paths.
- If Stripe is not configured, the chat keeps the draft brief but returns a safe payment-configuration message instead of exposing a fake checkout link.

## Business Value diagnostic worker

The root `render.yaml` defines a second web service named
`joz-business-value-worker` under `services/business-value-worker/`.

Set the Supabase Session Pooler URL as a secret on both services:

```env
DATABASE_URL=postgresql://...
BUSINESS_VALUE_DATABASE_URL=postgresql://...
```

The Blueprint generates a shared worker token and wires the backend to the
worker over Render's private service network. The worker requires
`BUSINESS_VALUE_DATABASE_URL` in production and initializes LangGraph's
Postgres checkpoint tables at startup.

Apply `server/supabase-schema.sql` followed by
`server/business-value-diagnostic.sql` and `server/ai-compliance.sql` in
Supabase before the first production deploy. All three migrations have already
been applied to the configured project.

## Local verification

```bash
cd /Users/jozzox/Downloads/xq/server
npm test
npm run dev
```
