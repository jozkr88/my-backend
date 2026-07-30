import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadTrajectoryFile } from "./world-model-dataset.mjs";
import {
  evaluateLearnedWorldModel,
  trainLearnedWorldModel,
} from "../shared/learnedWorldModel.js";

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function databaseUrl() {
  return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
}

async function loadTrajectoryRowsFromDatabase({ limit = 10000 } = {}) {
  const url = databaseUrl();
  if (!url) throw new Error("SUPABASE_DB_URL or DATABASE_URL is required with --database");
  const { default: pg } = await import("../server/node_modules/pg/esm/index.mjs");
  const { Pool } = pg;
  const pool = new Pool({ connectionString: url, max: 1, idleTimeoutMillis: 5_000 });
  try {
    const result = await pool.query(
      `SELECT trajectory_id, session_id, trace_id, schema_version,
              state_before, state_history, proposed_action,
              observed_state, classification, consent_compatible,
              is_test, is_synthetic, created_at, observed_at
         FROM world_model_trajectories
        ORDER BY COALESCE(observed_at, created_at), trajectory_id
        LIMIT $1`,
      [Math.min(50_000, Math.max(1, Number(limit) || 10_000))]
    );
    return result.rows || [];
  } finally {
    await pool.end();
  }
}

const inputPath = argument("--input");
const databaseInput = hasFlag("--database");
const limit = argument("--limit", "10000");
const outputPath = argument(
  "--output",
  path.resolve("data/joz/published/learned-world-model.json")
);
const evaluationPath = argument(
  "--evaluation-output",
  outputPath.replace(/\.json$/i, ".evaluation.json")
);

if (!inputPath) {
  if (!databaseInput) {
    throw new Error("Usage: npm run train:world-model -- --input <trajectory.jsonl> [--output <model.json>] or --database");
  }
}

const rows = inputPath
  ? await loadTrajectoryFile(inputPath)
  : await loadTrajectoryRowsFromDatabase({ limit });
const model = trainLearnedWorldModel(rows);
const evaluation = evaluateLearnedWorldModel(model, rows);
if (databaseInput && model.training.eligibleExamples < 1) {
  throw new Error("No eligible observed trajectories were found; refusing to publish an empty learned model artifact");
}
model.evaluation = evaluation;
model.provenance = {
  source: databaseInput ? "postgresql.world_model_trajectories" : "privacy_safe_trajectory_file",
  sourceRows: rows.length,
  excludesSyntheticInvalidUnsupported: true,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(model, null, 2)}\n`, "utf8");
await writeFile(evaluationPath, `${JSON.stringify(evaluation, null, 2)}\n`, "utf8");

process.stdout.write(`${JSON.stringify({
  inputPath,
  source: databaseInput ? "postgresql.world_model_trajectories" : "file",
  sourceRows: rows.length,
  outputPath,
  evaluationPath,
  training: model.training,
  evaluation,
}, null, 2)}\n`);
