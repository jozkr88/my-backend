import fs from "fs";
import path from "path";
import crypto from "crypto";
import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const { Pool } = pg;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveRepoRoot() {
  const candidates = [
    process.cwd(),
    path.resolve(__dirname, "..", ".."),
    path.resolve(__dirname, ".."),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "data", "joz", "published"))) {
      return candidate;
    }
  }

  return candidates[0];
}

const repoRoot = resolveRepoRoot();
const publishedPath = path.join(repoRoot, "data", "joz", "published", "joz-documents.generated.json");
const reportPath = path.join(repoRoot, "data", "joz", "published", "joz-knowledge-report.json");
const manifestPath = path.join(repoRoot, "data", "joz", "published", "joz-dataset-manifest.json");
const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";

if (!databaseUrl) {
  console.error("Missing SUPABASE_DB_URL or DATABASE_URL.");
  process.exit(1);
}

if (!fs.existsSync(publishedPath)) {
  console.error(`Missing published bundle: ${publishedPath}`);
  process.exit(1);
}

const published = JSON.parse(fs.readFileSync(publishedPath, "utf8"));
const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, "utf8")) : {};
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
const sourceRegistry = Array.isArray(manifest?.sources) ? manifest.sources : [];
const records = Array.isArray(published?.model_ready_records)
  ? published.model_ready_records
  : Array.isArray(published?.records)
    ? published.records
    : [];
const publishVersion =
  process.env.JOZ_PUBLISH_VERSION ||
  String(published?.generated_at || new Date().toISOString()).replace(/[:.]/g, "-");

const pool = new Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.NODE_ENV === "production" || process.env.RENDER || process.env.SUPABASE_DB_URL
      ? { rejectUnauthorized: false }
      : false,
});

function checksumForRecord(record = {}) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        slug: record.slug,
        title: record.title,
        category: record.category,
        summary: record.summary,
        body: record.body,
        metadata: record.metadata || {},
      })
    )
    .digest("hex");
}

async function ensurePrimaryProfile(client) {
  await client.query(
    `
      UPDATE joz_profiles
      SET is_primary = FALSE,
          updated_at = NOW()
      WHERE is_primary = TRUE
        AND slug <> 'joz-krupa'
    `
  );

  const result = await client.query(
    `
      INSERT INTO joz_profiles (
        slug,
        display_name,
        label,
        headline,
        summary,
        website_url,
        email,
        phone,
        location,
        is_primary
      )
      VALUES (
        'joz-krupa',
        'Joz Krupa',
        'Joz',
        'Agentic AI Architecture and Innovation Leader',
        'Primary public runtime profile for Joz knowledge retrieval.',
        'https://meetjoz.com',
        'joz@meetjoz.com',
        '+6531072412',
        'Dubai, Singapore, Zurich, Europe, Global markets',
        TRUE
      )
      ON CONFLICT (slug)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        label = EXCLUDED.label,
        headline = EXCLUDED.headline,
        summary = EXCLUDED.summary,
        website_url = EXCLUDED.website_url,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        location = EXCLUDED.location,
        is_primary = TRUE,
        updated_at = NOW()
      RETURNING id
    `
  );

  return result.rows[0].id;
}

async function publish() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS joz_datasets (
        id BIGSERIAL PRIMARY KEY,
        profile_id BIGINT NOT NULL REFERENCES joz_profiles(id) ON DELETE CASCADE,
        dataset_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        owner TEXT NOT NULL,
        classification TEXT NOT NULL DEFAULT 'public',
        visibility TEXT NOT NULL DEFAULT 'public',
        retention_policy TEXT NOT NULL DEFAULT 'until_withdrawn',
        schema_version TEXT NOT NULL DEFAULT '1.0',
        source_count INTEGER NOT NULL DEFAULT 0,
        normalized_count INTEGER NOT NULL DEFAULT 0,
        published_count INTEGER NOT NULL DEFAULT 0,
        model_ready_count INTEGER NOT NULL DEFAULT 0,
        verified_count INTEGER NOT NULL DEFAULT 0,
        content_checksum TEXT,
        status TEXT NOT NULL DEFAULT 'published',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (profile_id, dataset_id, tenant_id)
      );
      CREATE TABLE IF NOT EXISTS joz_data_sources (
        id BIGSERIAL PRIMARY KEY,
        profile_id BIGINT NOT NULL REFERENCES joz_profiles(id) ON DELETE CASCADE,
        dataset_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_key TEXT NOT NULL,
        source_filename TEXT,
        source_uri TEXT,
        source_types JSONB NOT NULL DEFAULT '[]'::jsonb,
        owner TEXT NOT NULL,
        classification TEXT NOT NULL DEFAULT 'public',
        visibility TEXT NOT NULL DEFAULT 'public',
        retention_policy TEXT NOT NULL DEFAULT 'until_withdrawn',
        record_count INTEGER NOT NULL DEFAULT 0,
        model_ready_count INTEGER NOT NULL DEFAULT 0,
        verified_count INTEGER NOT NULL DEFAULT 0,
        evidence_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
        source_checksum TEXT,
        status TEXT NOT NULL DEFAULT 'published',
        last_ingested_at TIMESTAMPTZ,
        last_published_at TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (profile_id, dataset_id, tenant_id, source_key)
      )
    `);

    const profileId = await ensurePrimaryProfile(client);
    const datasetId = String(manifest?.dataset_id || "joz-public-knowledge");
    const tenantId = String(manifest?.tenant_id || "public");

    await client.query(
      `
        INSERT INTO joz_datasets (
          profile_id, dataset_id, tenant_id, name, owner, classification,
          visibility, retention_policy, schema_version, source_count,
          normalized_count, published_count, model_ready_count, verified_count,
          content_checksum, status, metadata, published_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'published', $16::jsonb, NOW(), NOW())
        ON CONFLICT (profile_id, dataset_id, tenant_id)
        DO UPDATE SET
          name = EXCLUDED.name,
          owner = EXCLUDED.owner,
          classification = EXCLUDED.classification,
          visibility = EXCLUDED.visibility,
          retention_policy = EXCLUDED.retention_policy,
          schema_version = EXCLUDED.schema_version,
          source_count = EXCLUDED.source_count,
          normalized_count = EXCLUDED.normalized_count,
          published_count = EXCLUDED.published_count,
          model_ready_count = EXCLUDED.model_ready_count,
          verified_count = EXCLUDED.verified_count,
          content_checksum = EXCLUDED.content_checksum,
          status = EXCLUDED.status,
          metadata = EXCLUDED.metadata,
          published_at = EXCLUDED.published_at,
          updated_at = NOW()
      `,
      [
        profileId,
        datasetId,
        tenantId,
        datasetId,
        String(manifest?.owner || "joz"),
        String(manifest?.classification || "public"),
        String(manifest?.visibility || "public"),
        String(manifest?.retention_policy || "until_withdrawn"),
        String(manifest?.schema_version || "1.0"),
        Number(manifest?.source_count || 0),
        Number(manifest?.normalized_count || 0),
        records.length,
        Number(manifest?.model_ready_count || records.length),
        Number(manifest?.verified_count || 0),
        String(manifest?.content_checksum || ""),
        JSON.stringify(manifest),
      ]
    );

    await client.query(
      `
        UPDATE joz_data_sources
        SET status = 'inactive', updated_at = NOW()
        WHERE profile_id = $1 AND dataset_id = $2 AND tenant_id = $3
      `,
      [profileId, datasetId, tenantId]
    );

    for (const source of sourceRegistry) {
      await client.query(
        `
          INSERT INTO joz_data_sources (
            profile_id, dataset_id, tenant_id, source_id, source_key,
            source_filename, source_uri, source_types, owner, classification,
            visibility, retention_policy, record_count, model_ready_count,
            verified_count, evidence_tiers, source_checksum, status,
            last_ingested_at, last_published_at, metadata, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, 'published', $18, NOW(), $19::jsonb, NOW())
          ON CONFLICT (profile_id, dataset_id, tenant_id, source_key)
          DO UPDATE SET
            source_id = EXCLUDED.source_id,
            source_filename = EXCLUDED.source_filename,
            source_uri = EXCLUDED.source_uri,
            source_types = EXCLUDED.source_types,
            owner = EXCLUDED.owner,
            classification = EXCLUDED.classification,
            visibility = EXCLUDED.visibility,
            retention_policy = EXCLUDED.retention_policy,
            record_count = EXCLUDED.record_count,
            model_ready_count = EXCLUDED.model_ready_count,
            verified_count = EXCLUDED.verified_count,
            evidence_tiers = EXCLUDED.evidence_tiers,
            source_checksum = EXCLUDED.source_checksum,
            status = EXCLUDED.status,
            last_ingested_at = EXCLUDED.last_ingested_at,
            last_published_at = EXCLUDED.last_published_at,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        `,
        [
          profileId,
          datasetId,
          tenantId,
          source.source_id,
          source.source_key,
          source.source_filename || null,
          source.source_uri || null,
          JSON.stringify(source.source_types || []),
          source.owner || "joz",
          source.classification || "public",
          source.visibility || "public",
          source.retention_policy || "until_withdrawn",
          Number(source.record_count || 0),
          Number(source.model_ready_count || 0),
          Number(source.verified_count || 0),
          JSON.stringify(source.evidence_tiers || []),
          source.source_checksum || null,
          new Date().toISOString(),
          JSON.stringify(source),
        ]
      );
    }

    await client.query(
      `
        UPDATE joz_documents
        SET is_runtime_active = FALSE,
            updated_at = NOW()
        WHERE profile_id IN (
          SELECT id
          FROM joz_profiles
          WHERE is_primary = FALSE
        )
          AND is_runtime_active = TRUE
      `
    );

    await client.query(
      `
        INSERT INTO joz_publish_runs (
          profile_id,
          publish_version,
          source_type,
          source_count,
          normalized_count,
          published_count,
          verification_summary,
          source_bundle_path,
          notes,
          status
        )
        VALUES ($1, $2, 'joz_knowledge', $3, $4, $5, $6::jsonb, $7, $8, 'published')
        ON CONFLICT (publish_version)
        DO UPDATE SET
          profile_id = EXCLUDED.profile_id,
          source_count = EXCLUDED.source_count,
          normalized_count = EXCLUDED.normalized_count,
          published_count = EXCLUDED.published_count,
          verification_summary = EXCLUDED.verification_summary,
          source_bundle_path = EXCLUDED.source_bundle_path,
          notes = EXCLUDED.notes,
          status = EXCLUDED.status
      `,
      [
        profileId,
        publishVersion,
        Number(published?.counts?.source_files || 0),
        Number(published?.counts?.normalized_records || 0),
        records.length,
        JSON.stringify(report?.counts || published?.counts || {}),
        publishedPath,
        "Published from deterministic file build into Supabase runtime store.",
      ]
    );

    await client.query(
      `
        UPDATE joz_documents
        SET is_runtime_active = FALSE,
            updated_at = NOW()
        WHERE profile_id = $1
      `,
      [profileId]
    );

    for (const record of records) {
      const metadata = {
        ...(record.metadata || {}),
        slug: record.slug,
        publish_version: publishVersion,
        visibility: "public",
      };

      await client.query(
        `
          INSERT INTO joz_documents (
            profile_id,
            slug,
            title,
            category,
            source_type,
            source_uri,
            summary,
            body,
            metadata,
            visibility,
            is_runtime_active,
            publish_version,
            source_checksum,
            published_at,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'public', TRUE, $10, $11, NOW(), NOW()
          )
          ON CONFLICT (profile_id, slug)
          DO UPDATE SET
            title = EXCLUDED.title,
            category = EXCLUDED.category,
            source_type = EXCLUDED.source_type,
            source_uri = EXCLUDED.source_uri,
            summary = EXCLUDED.summary,
            body = EXCLUDED.body,
            metadata = EXCLUDED.metadata,
            visibility = EXCLUDED.visibility,
            is_runtime_active = EXCLUDED.is_runtime_active,
            publish_version = EXCLUDED.publish_version,
            source_checksum = EXCLUDED.source_checksum,
            published_at = EXCLUDED.published_at,
            updated_at = NOW()
        `,
        [
          profileId,
          record.slug,
          record.title,
          record.category,
          record.source_type || "paste",
          record.source_uri || null,
          record.summary || null,
          record.body || "",
          JSON.stringify(metadata),
          publishVersion,
          checksumForRecord(record),
        ]
      );
    }

    await client.query("COMMIT");
    console.log(`Published ${records.length} Joz runtime record(s) to Supabase as ${publishVersion}.`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Failed to publish Joz records to Supabase:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

publish();
