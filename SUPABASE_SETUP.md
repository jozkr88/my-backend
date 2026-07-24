## Supabase Setup

This backend can use Supabase Postgres directly through a standard Postgres connection string.

### 1. Create the database

- Create a Supabase project.
- In Supabase, open the SQL editor.
- Run [supabase-schema.sql](/Users/jozzox/Downloads/xq/server/supabase-schema.sql).
- Then run [joz-llm-seed.sql](/Users/jozzox/Downloads/xq/server/joz-llm-seed.sql).

### 2. Add environment variables

In your local [server/.env](/Users/jozzox/Downloads/xq/server/.env) or deployment env:

```env
OPENAI_API_KEY=...
SUPABASE_DB_URL=postgresql://postgres:<password>@<host>:5432/postgres
SUPABASE_URL=https://your-project.supabase.co
JOZ_REQUIRE_AUTH=true
JOZ_REQUIRE_DATABASE=true
```

`DATABASE_URL` also works, but `SUPABASE_DB_URL` is preferred for clarity.

### 3. Start the backend

```bash
cd /Users/jozzox/Downloads/xq/server
npm run dev
```

If the DB connection is present, the server will:

- use Postgres for `meet-joz` transitions first
- log reasoning decisions into `reasoning_events`
- have the initial Joz LLM profile, button-lane capabilities, and seeded knowledge documents available
- fail closed in production when no DB URL is set; local development can explicitly set `JOZ_REQUIRE_DATABASE=false` to use the non-durable fallback

### Notes

- This is direct Postgres access, not the Supabase JS client.
- Your Express backend remains the reasoning gateway.
- Supabase is only the database layer in this setup.
- Supabase Auth issues the access JWT. The frontend sends it as `Authorization: Bearer ...`; Express verifies it before proposal approval or execution. Set `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` in the frontend build environment and use `/auth` for email/password or magic-link sign-in.

## Callback Email Notification With Supabase

If you want Supabase to send the admin notification when a new `joz_callback_requests` row is inserted, use the included Edge Function plus SQL trigger.

### 1. Deploy the Edge Function

Files:

- [supabase/functions/callback-email/index.ts](/Users/jozzox/Downloads/xq/supabase/functions/callback-email/index.ts)

From the repo root:

```bash
supabase functions deploy callback-email
```

### 2. Set Function Secrets

In Supabase, set these secrets for the Edge Function:

```env
RESEND_API_KEY=...
CALLBACK_EMAIL_TO=joz@meetjoz.com
CALLBACK_EMAIL_FROM=notifications@your-domain.com
CALLBACK_WEBHOOK_SECRET=a-long-random-secret
```

Notes:

- `CALLBACK_EMAIL_FROM` must be a sender/domain verified in Resend.
- `CALLBACK_WEBHOOK_SECRET` should be a long random string and must match the SQL trigger file below.

### 3. Create the Trigger

Open Supabase SQL Editor and run:

- [server/supabase-callback-email.sql](/Users/jozzox/Downloads/xq/server/supabase-callback-email.sql)

Before you run it:

- replace `your-project-ref` with your actual Supabase project ref
- replace `replace-with-a-long-random-secret` with the same `CALLBACK_WEBHOOK_SECRET`

This creates a Postgres trigger that POSTs every new callback request row to the Edge Function.

### 4. Test It

Insert a callback request through the site, or manually insert into `public.joz_callback_requests`.

Expected result:

- the row is stored in Supabase
- the trigger calls the `callback-email` Edge Function
- the function sends one email to `joz@meetjoz.com` through Resend

### 5. Recommended Production Behavior

- Keep Twilio disabled if you only want email notifications.
- Keep the backend email path as a temporary fallback until you confirm the Supabase trigger path is working.
- After that, you can remove the backend callback email delivery if you want one single notification path.
