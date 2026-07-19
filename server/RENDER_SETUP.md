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
DATABASE_URL=postgresql://...
DISABLE_FILE_MEMORY=1
```

Notes:

- `DATABASE_URL` is preferred on Render. The backend also accepts `SUPABASE_DB_URL`.
- `DISABLE_FILE_MEMORY=1` disables `worldMemory.json` writes because Render web services do not provide durable local disk storage across restarts/deploys.
- If `DATABASE_URL` is missing, the backend still runs, but any learned world memory is process-local and non-durable on Render.

## Local verification

```bash
cd /Users/jozzox/Downloads/xq/server
npm test
npm run dev
```
