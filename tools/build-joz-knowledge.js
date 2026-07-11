import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const dataRoot = path.join(repoRoot, "data", "joz");
const inboxDir = path.join(dataRoot, "inbox");
const normalizedDir = path.join(dataRoot, "normalized");
const publishedDir = path.join(dataRoot, "published");

const allowedCategories = new Set([
  "bio",
  "skills",
  "case_study",
  "mindset",
  "service",
  "proof",
  "faq",
  "business_need",
  "booking",
]);

const allowedLanes = new Set([
  "business_need",
  "mindset",
  "skills",
  "booking",
]);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function listSourceFiles() {
  if (!fs.existsSync(inboxDir)) return [];
  return fs
    .readdirSync(inboxDir)
    .filter((name) => name.endsWith(".md") || name.endsWith(".txt"))
    .sort();
}

function getBaseName(filename) {
  return filename.replace(/\.(md|txt)$/i, "");
}

function validateMeta(meta, body, sourceName) {
  const errors = [];

  if (!meta || typeof meta !== "object") {
    errors.push("Missing metadata object.");
    return errors;
  }

  if (!String(meta.slug || "").trim()) errors.push("Missing `slug`.");
  if (!String(meta.title || "").trim()) errors.push("Missing `title`.");
  if (!String(meta.summary || "").trim()) errors.push("Missing `summary`.");
  if (!String(meta.category || "").trim()) errors.push("Missing `category`.");
  if (!String(meta.lane || "").trim()) errors.push("Missing `lane`.");
  if (!String(body || "").trim()) errors.push("Missing source body text.");

  if (meta.category && !allowedCategories.has(meta.category)) {
    errors.push(`Invalid category \`${meta.category}\`.`);
  }

  if (meta.lane && !allowedLanes.has(meta.lane)) {
    errors.push(`Invalid lane \`${meta.lane}\`.`);
  }

  if (!Array.isArray(meta.tags)) errors.push("`tags` must be an array.");
  if (!Array.isArray(meta.claims)) errors.push("`claims` must be an array.");
  if (!Array.isArray(meta.proof_points)) errors.push("`proof_points` must be an array.");

  const verificationStatus = String(meta?.verification?.status || "").trim();
  if (!verificationStatus) {
    errors.push("Missing `verification.status`.");
  }

  return errors.map((error) => `${sourceName}: ${error}`);
}

function buildNormalizedRecord(baseName, sourceFilename) {
  const sourcePath = path.join(inboxDir, sourceFilename);
  const metaPath = path.join(inboxDir, `${baseName}.meta.json`);

  if (!fs.existsSync(metaPath)) {
    return {
      errors: [`${sourceFilename}: Missing sidecar metadata file ${baseName}.meta.json`],
      record: null,
    };
  }

  const body = fs.readFileSync(sourcePath, "utf8").trim();
  const meta = readJson(metaPath);
  const errors = validateMeta(meta, body, sourceFilename);

  const normalized = {
    slug: String(meta.slug || "").trim(),
    title: String(meta.title || "").trim(),
    category: String(meta.category || "").trim(),
    source_type: String(meta.source_type || "paste").trim(),
    source_uri: String(meta.source_uri || "").trim() || null,
    summary: String(meta.summary || "").trim(),
    body,
    metadata: {
      lane: String(meta.lane || "").trim(),
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      verification: meta.verification || {},
      verification_status: String(meta?.verification?.status || "").trim() || "draft",
      claims: Array.isArray(meta.claims) ? meta.claims : [],
      proof_points: Array.isArray(meta.proof_points) ? meta.proof_points : [],
      regions: Array.isArray(meta.regions) ? meta.regions : [],
      companies: Array.isArray(meta.companies) ? meta.companies : [],
      impact_score: Number.isFinite(Number(meta.impact_score))
        ? Number(meta.impact_score)
        : 0,
      priority_label: String(meta.priority_label || "").trim() || "standard",
      source_filename: sourceFilename,
      source_meta_filename: `${baseName}.meta.json`,
    },
  };

  return { errors, record: normalized };
}

function main() {
  ensureDir(normalizedDir);
  ensureDir(publishedDir);

  const sourceFiles = listSourceFiles();
  const errors = [];
  const records = [];

  for (const sourceFilename of sourceFiles) {
    const baseName = getBaseName(sourceFilename);
    const { errors: itemErrors, record } = buildNormalizedRecord(baseName, sourceFilename);
    errors.push(...itemErrors);
    if (!record) continue;

    writeJson(path.join(normalizedDir, `${baseName}.json`), record);
    records.push(record);
  }

  const published = {
    generated_at: new Date().toISOString(),
    counts: {
      source_files: sourceFiles.length,
      normalized_records: records.length,
      verified_records: records.filter(
        (record) => record.metadata.verification_status === "verified"
      ).length,
      errors: errors.length,
    },
    records,
  };

  writeJson(path.join(publishedDir, "joz-documents.generated.json"), published);
  writeJson(path.join(publishedDir, "joz-knowledge-report.json"), {
    generated_at: published.generated_at,
    counts: published.counts,
    errors,
  });

  if (errors.length) {
    console.error("Joz knowledge build failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Built ${records.length} Joz knowledge record(s) from ${sourceFiles.length} source file(s).`
  );
}

main();
