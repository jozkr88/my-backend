import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const root = path.resolve(process.cwd(), "..");
const publishedDir = path.join(root, "data", "joz", "published");
const bundlePath = path.join(publishedDir, "joz-documents.generated.json");
const manifestPath = path.join(publishedDir, "joz-dataset-manifest.json");
const qualityPath = path.join(process.cwd(), "content", "joz-quality-latest-report.json");

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function summarizeLocalData() {
  const bundle = readJson(bundlePath, {});
  const manifest = readJson(manifestPath, {});
  const quality = readJson(qualityPath, {});
  const records = Array.isArray(bundle?.records) ? bundle.records : [];
  const internalPathRecords = records.filter((record) =>
    /\/Users\/|\/home\/|\.codex[\\/]attachments|pasted-text/i.test(JSON.stringify(record))
  ).length;
  const governanceComplete = records.filter((record) => {
    const metadata = record?.metadata || {};
    return [
      "schema_version",
      "dataset_id",
      "tenant_id",
      "owner",
      "classification",
      "visibility",
      "retention_policy",
      "evidence_tier",
      "source_checksum",
    ].every((field) => metadata[field]);
  }).length;

  return {
    generatedAt: bundle?.generated_at || null,
    manifest,
    recordCount: records.length,
    modelReadyCount: Array.isArray(bundle?.model_ready_records) ? bundle.model_ready_records.length : 0,
    governanceCompleteCount: governanceComplete,
    internalPathRecords,
    sourceRegistry: Array.isArray(manifest?.sources) ? manifest.sources : [],
    quality: quality?.metrics || null,
  };
}

async function summarizeSupabase() {
  const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
  if (!databaseUrl) return { reachable: false, reason: "missing_database_url" };

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const query = async (text, params = []) => (await pool.query(text, params)).rows;
    const result = {
      reachable: true,
      datasets: [],
      sources: [],
      counts: {},
    };

    try {
      result.datasets = await query(`
        SELECT dataset_id, tenant_id, name, owner, classification, visibility,
               schema_version, source_count, normalized_count, published_count,
               model_ready_count, verified_count, content_checksum, status,
               published_at, updated_at
        FROM joz_datasets
        ORDER BY updated_at DESC
      `);
      result.sources = await query(`
        SELECT dataset_id, tenant_id, source_id, source_key, source_filename,
               source_uri, source_types, owner, classification, visibility,
               record_count, model_ready_count, verified_count, evidence_tiers,
               source_checksum, status, last_published_at, updated_at
        FROM joz_data_sources
        ORDER BY dataset_id, source_key
      `);
    } catch (error) {
      result.controlPlane = { ready: false, reason: "control_plane_tables_missing", message: error.message };
    }

    const countRows = await query(`
      SELECT
        (SELECT COUNT(*) FROM joz_documents)::int AS documents,
        (SELECT COUNT(*) FROM joz_documents WHERE is_runtime_active = TRUE)::int AS active_documents,
        (SELECT COUNT(*) FROM joz_conversations)::int AS conversations,
        (SELECT COUNT(*) FROM joz_messages)::int AS messages,
        (SELECT COUNT(*) FROM joz_llm_request_events)::int AS request_events,
        (SELECT COUNT(*) FROM joz_llm_evaluations)::int AS evaluations
    `);
    result.counts = countRows[0] || {};
    return result;
  } catch (error) {
    return { reachable: false, code: error.code || null, reason: error.message };
  } finally {
    await pool.end().catch(() => {});
  }
}

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  local: summarizeLocalData(),
  supabase: await summarizeSupabase(),
}, null, 2));
