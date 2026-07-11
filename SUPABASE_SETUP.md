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
- fall back to file memory if no DB URL is set

### Notes

- This is direct Postgres access, not the Supabase JS client.
- Your Express backend remains the reasoning gateway.
- Supabase is only the database layer in this setup.
