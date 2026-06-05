import pg from "pg";

const { Pool } = pg;

let pool = null;

function getDatabaseUrl() {
  return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
}

const TRANSITION_SEED = [
  ["meet-joz", "vibe", "flex", "vibe", null, "Opening Ascend."],
  ["meet-joz", "discover", "ascend", "discover", null, "Opening Mogg."],
  ["meet-joz", "skills", "mogg", "skills", null, "Opening workf."],
  ["meet-joz", "vibe", "back", "vibe_back", "/"],
  ["meet-joz", "discover", "back", "vibe_back", null],
  ["meet-joz", "skills", "back", "vibe_back1", null],
  ["meet-joz", "vibe", "pause", "pause", null],
  ["meet-joz", "discover", "pause", "pause", null],
  ["meet-joz", "skills", "pause", "pause", null],
  ["meet-joz", "vibe", "resume", "resume", null],
  ["meet-joz", "discover", "resume", "resume", null],
  ["meet-joz", "skills", "resume", "resume", null],
  ["meet-joz", "vibe", "exit", "back", "/"],
  ["meet-joz", "discover", "exit", "back", "/"],
  ["meet-joz", "skills", "exit", "back", "/"],
  ["meet-joz", "vibe", "launch", "launch_in_space_workf", null],
  ["meet-joz", "discover", "launch", "launch_in_space_workf", null],
  ["meet-joz", "skills", "launch", "launch_in_space_workf", null],
];

export function isDatabaseEnabled() {
  return Boolean(getDatabaseUrl());
}

function getPool() {
  if (!isDatabaseEnabled()) return null;
  if (pool) return pool;

  pool = new Pool({
    connectionString: getDatabaseUrl(),
    ssl: process.env.NODE_ENV === "production" || process.env.RENDER || process.env.SUPABASE_DB_URL
      ? { rejectUnauthorized: false }
      : false,
  });

  return pool;
}

export async function initDatabase() {
  const db = getPool();
  if (!db) {
    console.log("🗄️ No database URL set, using file memory only");
    return;
  }

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS portal_transitions (
        portal_key TEXT NOT NULL,
        current_state TEXT NOT NULL,
        command_key TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT,
        awareness TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (portal_key, current_state, command_key)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS reasoning_events (
        id BIGSERIAL PRIMARY KEY,
        portal_key TEXT,
        current_state TEXT,
        transcript TEXT,
        normalized_transcript TEXT,
        command_key TEXT,
        resolved_action TEXT,
        resolved_target TEXT,
        source TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const [portalKey, currentState, commandKey, action, target, awareness = null] of TRANSITION_SEED) {
      await db.query(
        `
          INSERT INTO portal_transitions (
            portal_key, current_state, command_key, action, target, awareness
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (portal_key, current_state, command_key)
          DO UPDATE SET
            action = EXCLUDED.action,
            target = EXCLUDED.target,
            awareness = EXCLUDED.awareness,
            updated_at = NOW()
        `,
        [portalKey, currentState, commandKey, action, target, awareness],
      );
    }

    console.log("🗄️ Supabase/Postgres ready");
  } catch (error) {
    console.error("⚠️ Database init failed, falling back to file memory:", error.message);
    if (pool) {
      await pool.end().catch(() => {});
      pool = null;
    }
    delete process.env.SUPABASE_DB_URL;
    delete process.env.DATABASE_URL;
  }
}

export async function getPortalTransition(portalKey, currentState, commandKey) {
  const db = getPool();
  if (!db) return null;

  const { rows } = await db.query(
    `
      SELECT action, target, awareness
      FROM portal_transitions
      WHERE portal_key = $1
        AND current_state = $2
        AND command_key = $3
      LIMIT 1
    `,
    [portalKey, currentState, commandKey],
  );

  return rows[0] || null;
}

export async function logReasoningEvent(event) {
  const db = getPool();
  if (!db) return;

  const {
    portalKey = null,
    currentState = null,
    transcript = null,
    normalizedTranscript = null,
    commandKey = null,
    resolvedAction = null,
    resolvedTarget = null,
    source = null,
  } = event;

  try {
    await db.query(
      `
        INSERT INTO reasoning_events (
          portal_key,
          current_state,
          transcript,
          normalized_transcript,
          command_key,
          resolved_action,
          resolved_target,
          source
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        portalKey,
        currentState,
        transcript,
        normalizedTranscript,
        commandKey,
        resolvedAction,
        resolvedTarget,
        source,
      ],
    );
  } catch (error) {
    console.error("⚠️ Failed to log reasoning event:", error.message);
  }
}
