import crypto from "node:crypto";
import path from "node:path";

export const JOZ_DATA_SCHEMA_VERSION = "1.0";
export const JOZ_PUBLIC_DATASET_ID = "joz-public-knowledge";
export const JOZ_PUBLIC_TENANT_ID = "public";
export const JOZ_DEFAULT_OWNER = "joz";
export const JOZ_DEFAULT_CLASSIFICATION = "public";
export const JOZ_DEFAULT_RETENTION_POLICY = "until_withdrawn";

export function sha256(value = "") {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

export function evidenceTierForStatus(status = "") {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "verified") return "verified_fact";
  if (["cv_supported", "project_supported", "capability_supported", "positioning_supported", "cv_and_project_supported"].includes(normalized)) {
    return "supported_claim";
  }
  if (normalized === "framework_supported") return "framework_guidance";
  return "unverified";
}

function safeSourceName(value = "") {
  return path.basename(String(value || "")).replace(/[^a-zA-Z0-9._-]+/g, "-") || "source";
}

export function sanitizeSourceUri(value = "", fallbackName = "source") {
  const sourceUri = String(value || "").trim();
  if (!sourceUri) return null;

  if (
    sourceUri.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(sourceUri) ||
    /(?:\.codex[\\/]attachments|pasted-text\.txt)/i.test(sourceUri)
  ) {
    return `source://joz/${safeSourceName(fallbackName)}`;
  }

  return sourceUri;
}

export function buildGovernanceMetadata({
  metadata = {},
  body = "",
  sourceFilename = "",
  sourceUri = "",
  verificationStatus = "draft",
  datasetId = JOZ_PUBLIC_DATASET_ID,
  tenantId = JOZ_PUBLIC_TENANT_ID,
} = {}) {
  const classification = String(metadata.classification || JOZ_DEFAULT_CLASSIFICATION).trim().toLowerCase();
  const visibility = String(metadata.visibility || (classification === "public" ? "public" : "restricted")).trim().toLowerCase();
  const normalizedStatus = String(verificationStatus || "draft").trim().toLowerCase();

  return {
    ...metadata,
    schema_version: String(metadata.schema_version || JOZ_DATA_SCHEMA_VERSION),
    dataset_id: String(metadata.dataset_id || datasetId),
    tenant_id: String(metadata.tenant_id || tenantId),
    owner: String(metadata.owner || JOZ_DEFAULT_OWNER),
    classification,
    visibility,
    retention_policy: String(metadata.retention_policy || JOZ_DEFAULT_RETENTION_POLICY),
    evidence_tier: String(metadata.evidence_tier || evidenceTierForStatus(normalizedStatus)),
    source_checksum: sha256(body),
    source_uri: sanitizeSourceUri(sourceUri, sourceFilename),
  };
}

export function buildDatasetManifest({
  generatedAt,
  records = [],
  sourceCount = 0,
  canonicalSourceCount = 0,
  errors = 0,
  datasetId = JOZ_PUBLIC_DATASET_ID,
  tenantId = JOZ_PUBLIC_TENANT_ID,
} = {}) {
  const recordChecksums = records
    .map((record) => `${record.slug}:${record.metadata?.source_checksum || sha256(record.body || "")}`)
    .sort()
    .join("\n");

  return {
    schema_version: JOZ_DATA_SCHEMA_VERSION,
    dataset_id: datasetId,
    tenant_id: tenantId,
    owner: JOZ_DEFAULT_OWNER,
    classification: JOZ_DEFAULT_CLASSIFICATION,
    visibility: "public",
    retention_policy: JOZ_DEFAULT_RETENTION_POLICY,
    generated_at: generatedAt,
    source_count: sourceCount,
    canonical_source_count: canonicalSourceCount,
    normalized_count: records.length,
    model_ready_count: records.filter((record) => record.metadata?.evidence_tier !== "unverified").length,
    verified_count: records.filter((record) => record.metadata?.evidence_tier === "verified_fact").length,
    error_count: errors,
    content_checksum: sha256(recordChecksums),
  };
}

export function buildSourceRegistry(records = [], { datasetId = JOZ_PUBLIC_DATASET_ID, tenantId = JOZ_PUBLIC_TENANT_ID } = {}) {
  const grouped = new Map();

  for (const record of records) {
    const metadata = record?.metadata || {};
    const sourceKey = String(metadata.source_filename || record.source_uri || record.slug || "unknown-source").trim();
    const current = grouped.get(sourceKey) || {
      source_key: sourceKey,
      source_filename: metadata.source_filename || sourceKey,
      source_uri: metadata.source_uri || record.source_uri || null,
      source_types: new Set(),
      dataset_id: metadata.dataset_id || datasetId,
      tenant_id: metadata.tenant_id || tenantId,
      owner: metadata.owner || JOZ_DEFAULT_OWNER,
      classification: metadata.classification || JOZ_DEFAULT_CLASSIFICATION,
      visibility: metadata.visibility || "public",
      retention_policy: metadata.retention_policy || JOZ_DEFAULT_RETENTION_POLICY,
      record_count: 0,
      model_ready_count: 0,
      verified_count: 0,
      evidence_tiers: new Set(),
      checksums: [],
    };

    current.source_types.add(record.source_type || "unknown");
    current.record_count += 1;
    if (metadata.evidence_tier !== "unverified") current.model_ready_count += 1;
    if (metadata.evidence_tier === "verified_fact") current.verified_count += 1;
    current.evidence_tiers.add(metadata.evidence_tier || "unverified");
    current.checksums.push(`${record.slug}:${metadata.source_checksum || sha256(record.body || "")}`);
    grouped.set(sourceKey, current);
  }

  return [...grouped.values()].map((source) => ({
    source_id: sha256(`${source.dataset_id}:${source.tenant_id}:${source.source_key}`).slice(0, 24),
    source_key: source.source_key,
    source_filename: source.source_filename,
    source_uri: source.source_uri,
    source_types: [...source.source_types].sort(),
    dataset_id: source.dataset_id,
    tenant_id: source.tenant_id,
    owner: source.owner,
    classification: source.classification,
    visibility: source.visibility,
    retention_policy: source.retention_policy,
    record_count: source.record_count,
    model_ready_count: source.model_ready_count,
    verified_count: source.verified_count,
    evidence_tiers: [...source.evidence_tiers].sort(),
    source_checksum: sha256(source.checksums.sort().join("\n")),
    status: "published",
  })).sort((left, right) => left.source_key.localeCompare(right.source_key));
}

export function buildDatasetControlManifest({
  generatedAt,
  records = [],
  sourceCount = 0,
  canonicalSourceCount = 0,
  errors = 0,
  datasetId = JOZ_PUBLIC_DATASET_ID,
  tenantId = JOZ_PUBLIC_TENANT_ID,
} = {}) {
  const manifest = buildDatasetManifest({
    generatedAt,
    records,
    sourceCount,
    canonicalSourceCount,
    errors,
    datasetId,
    tenantId,
  });
  const sources = buildSourceRegistry(records, { datasetId, tenantId });
  return {
    ...manifest,
    source_registry_count: sources.length,
    source_registry_checksum: sha256(sources.map((source) => `${source.source_key}:${source.source_checksum}`).join("\n")),
    sources,
  };
}

export function isDocumentAllowedForTenant(document = {}, { tenantId = JOZ_PUBLIC_TENANT_ID, datasetId = null } = {}) {
  const metadata = document?.metadata || {};
  const documentTenantId = String(metadata.tenant_id || JOZ_PUBLIC_TENANT_ID).trim();
  const documentDatasetId = String(metadata.dataset_id || "").trim();
  const visibility = String(metadata.visibility || document.visibility || "public").trim().toLowerCase();

  if (visibility !== "public") return false;
  if (documentTenantId !== String(tenantId || JOZ_PUBLIC_TENANT_ID)) return false;
  if (datasetId && documentDatasetId !== String(datasetId)) return false;
  return true;
}
