import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;
const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
const privateName = String(process.env.JOZ_PRIVATE_MC_USA_NAME || "").trim();

if (!databaseUrl) {
  throw new Error("Missing SUPABASE_DB_URL or DATABASE_URL");
}

if (!privateName) {
  throw new Error("Missing JOZ_PRIVATE_MC_USA_NAME secret");
}

if (privateName.toLowerCase() === "mc usa") {
  throw new Error("JOZ_PRIVATE_MC_USA_NAME must contain the private legal name, not the public alias");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.NODE_ENV === "production" || process.env.RENDER || process.env.SUPABASE_DB_URL
      ? { rejectUnauthorized: false }
      : false,
});

try {
  await pool.query("BEGIN");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS joz_private_knowledge_aliases (
      id BIGSERIAL PRIMARY KEY,
      alias_key TEXT NOT NULL UNIQUE,
      public_label TEXT NOT NULL,
      private_value TEXT NOT NULL,
      classification TEXT NOT NULL DEFAULT 'confidential',
      source TEXT NOT NULL DEFAULT 'private_secret_migration',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("ALTER TABLE joz_private_knowledge_aliases ENABLE ROW LEVEL SECURITY");
  await pool.query("REVOKE ALL ON TABLE joz_private_knowledge_aliases FROM PUBLIC");
  await pool.query(
    `
      INSERT INTO joz_private_knowledge_aliases (
        alias_key, public_label, private_value, classification, source, updated_at
      )
      VALUES ($1, $2, $3, 'confidential', 'private_secret_migration', NOW())
      ON CONFLICT (alias_key)
      DO UPDATE SET
        public_label = EXCLUDED.public_label,
        private_value = EXCLUDED.private_value,
        classification = EXCLUDED.classification,
        source = EXCLUDED.source,
        updated_at = NOW()
    `,
    ["mc_usa", "MC USA", privateName]
  );
  await pool.query("COMMIT");
  console.log("Stored the private MC USA alias in the database.");
} catch (error) {
  await pool.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await pool.end();
}
