import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { initDatabase, publishJozCausalDataset } from "../../db.js";
import { validateJozCausalDataset } from "../../shared/jozCausalDatasetRegistry.js";
import { upsertJozCausalDatasetMetadataToNeo4j } from "../../shared/neo4jJozKnowledgeGraph.js";

dotenv.config({ path: path.resolve(process.cwd(), "server/.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const inputPath = process.argv[2];
const requestedStatus = String(process.argv[3] || "published").trim().toLowerCase();
const allowedStatuses = new Set(["draft", "validated", "published", "deprecated"]);

if (!inputPath || !allowedStatuses.has(requestedStatus)) {
  console.error("Usage: node server/tools/publish-causal-dataset.js <dataset.json> [draft|validated|published|deprecated]");
  process.exitCode = 2;
} else {
  try {
    const payload = JSON.parse(await fs.readFile(path.resolve(process.cwd(), inputPath), "utf8"));
    const validation = validateJozCausalDataset(payload);
    if (!validation.ok) {
      console.error(JSON.stringify({ ok: false, status: "invalid", errors: validation.errors }, null, 2));
      process.exitCode = 1;
    } else {
      await initDatabase();
      const published = await publishJozCausalDataset({ dataset: validation.dataset, status: requestedStatus });
      const neo4j = requestedStatus === "published"
        ? await upsertJozCausalDatasetMetadataToNeo4j({ dataset: validation.dataset })
        : { configured: false, skipped: true, reason: "dataset_not_published" };
      console.log(JSON.stringify({ ok: true, ...published, neo4j }, null, 2));
    }
  } catch (error) {
    console.error(JSON.stringify({ ok: false, status: "failed", error: String(error?.message || error) }, null, 2));
    process.exitCode = 1;
  }
}
