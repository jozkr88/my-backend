import {
  exportPrivacySafeDataset,
  loadTrajectoryFile,
} from "./world-model-dataset.mjs";

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function databaseUrl() {
  return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
}

async function loadFromDatabase({ from, to, schemaVersion, limit }) {
  const { default: pg } = await import("../server/node_modules/pg/esm/index.mjs");
  const { Pool } = pg;
  const url = databaseUrl();
  if (!url) throw new Error("SUPABASE_DB_URL or DATABASE_URL is required when --input is omitted");
  const pool = new Pool({ connectionString: url, max: 1, idleTimeoutMillis: 5_000 });
  const filters = [];
  const values = [];
  if (from) { values.push(from); filters.push(`COALESCE(observed_at, created_at) >= $${values.length}`); }
  if (to) { values.push(to); filters.push(`COALESCE(observed_at, created_at) < $${values.length}`); }
  if (schemaVersion) { values.push(schemaVersion); filters.push(`schema_version = $${values.length}`); }
  values.push(Math.min(50_000, Math.max(1, Number(limit) || 10_000)));
  try {
    const result = await pool.query(
      `SELECT trajectory_id, session_id, trace_id, schema_version,
              interaction_channel, state_before, state_history, proposed_action,
              symbolic_prediction, probabilistic_prediction, expected_effects,
              observation_before, predicted_observation, observed_observation,
              observation_difference, observed_state, observed_effects,
              prediction_differences, planner_selected_action,
              deterministic_approved_action, candidate_plans, field_support,
              classification, failure_category, persistence_status, success,
              outcome_scores, model_version, transition_rule_version,
              world_model_mode, created_at, observed_at,
              prediction_latency_ms, observation_latency_ms, shadow_latency_ms,
              sample_rate, consent_compatible, is_test, is_synthetic
         FROM world_model_trajectories
        ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
        ORDER BY COALESCE(observed_at, created_at), trajectory_id
        LIMIT $${values.length}`,
      values
    );
    return result.rows || [];
  } finally {
    await pool.end();
  }
}

const input = argument("--input");
const output = argument("--output", "world-model-dataset");
const from = argument("--from");
const to = argument("--to");
const schemaVersion = argument("--schema-version");
const limit = argument("--limit", "10000");

const rows = input
  ? await loadTrajectoryFile(input)
  : await loadFromDatabase({ from, to, schemaVersion, limit });
const manifest = await exportPrivacySafeDataset(rows, output, { from, to });
console.log(JSON.stringify(manifest, null, 2));
