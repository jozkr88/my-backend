import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

export function executeJozAllowlistedAction({ proposal = {} } = {}) {
  if (proposal.action !== "generate_report") {
    const error = new Error(`Action is not allowlisted: ${proposal.action || "unknown"}`);
    error.status = 403;
    throw error;
  }

  const manifestPath = path.join(repoRoot(), "data", "joz", "published", "joz-dataset-manifest.json");
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    : {};

  return {
    action: proposal.action,
    report: {
      datasetId: manifest.dataset_id || "joz-public-knowledge",
      sourceCount: Number(manifest.source_registry_count || manifest.source_count || 0),
      modelReadyCount: Number(manifest.model_ready_count || 0),
      verifiedCount: Number(manifest.verified_count || 0),
      contentChecksum: manifest.content_checksum || null,
    },
    completedAt: new Date().toISOString(),
  };
}

export function verifyJozAllowlistedAction({ proposal = {}, result = {} } = {}) {
  const report = result?.report || {};
  const verified = proposal.action === "generate_report" &&
    Boolean(report.datasetId) &&
    Number.isFinite(Number(report.modelReadyCount)) &&
    Boolean(report.contentChecksum);

  return {
    verified,
    checks: [
      {
        id: "report_has_dataset_identity",
        status: report.datasetId ? "pass" : "fail",
      },
      {
        id: "report_has_model_ready_count",
        status: Number.isFinite(Number(report.modelReadyCount)) ? "pass" : "fail",
      },
      {
        id: "report_has_content_checksum",
        status: report.contentChecksum ? "pass" : "fail",
      },
    ],
  };
}
