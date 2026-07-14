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

    const profileId = await ensurePrimaryProfile(client);

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
