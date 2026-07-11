import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveRepoRoot() {
  const candidates = [
    process.cwd(),
    path.resolve(__dirname, "..", ".."),
    path.resolve(__dirname, ".."),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "data", "joz"))) {
      return candidate;
    }
  }

  return candidates[0];
}

const repoRoot = resolveRepoRoot();

const dataRoot = path.join(repoRoot, "data", "joz");
const inboxDir = path.join(dataRoot, "inbox");
const normalizedDir = path.join(dataRoot, "normalized");
const publishedDir = path.join(dataRoot, "published");
const ontologyDir = path.join(dataRoot, "ontology");

const ontologyFiles = {
  problems: "problems.json",
  principles: "principles.json",
  capabilities: "capabilities.json",
  outcomes: "outcomes.json",
  governance: "governance.json",
  industries: "industries.json",
  proofs: "proofs.json",
};

const ontologyFields = [
  "problems",
  "principles",
  "capabilities",
  "outcomes",
  "governance",
  "industries",
  "proofs",
];

const allowedCategories = new Set([
  "bio",
  "skills",
  "case_study",
  "mindset",
  "systems_mindset",
  "service",
  "proof",
  "faq",
  "business_need",
  "booking",
  "governance",
  "governance_principle",
  "capability",
  "business_answer",
  "roi",
  "delivery",
  "narrative",
  "domain",
  "recruiter_operations",
  "decision_pattern",
  "feedback_loop",
  "systems_principle",
  "failure_pattern",
]);

const allowedLanes = new Set([
  "business_need",
  "mindset",
  "systems_mindset",
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

function normalizeLane(value = "") {
  const lane = String(value || "").trim().toLowerCase();
  return lane === "mindset" ? "systems_mindset" : lane;
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))].sort()
    : [];
}

function normalizeVerification(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const status = String(value.status || "").trim() || "draft";
    return {
      status,
      reviewed_by: String(value.reviewed_by || "").trim(),
      reviewed_at: String(value.reviewed_at || "").trim(),
      notes: String(value.notes || "").trim(),
    };
  }

  const status = String(value || "").trim() || "draft";
  return {
    status,
    reviewed_by: "",
    reviewed_at: "",
    notes: "",
  };
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

function loadOntologyBundle() {
  const bundle = {};
  const indexes = {};
  const errors = [];

  for (const [field, filename] of Object.entries(ontologyFiles)) {
    const filePath = path.join(ontologyDir, filename);
    if (!fs.existsSync(filePath)) {
      errors.push(`Missing ontology file ${filename}`);
      bundle[field] = [];
      indexes[field] = new Map();
      continue;
    }

    const records = readJson(filePath);
    const seen = new Set();
    const index = new Map();

    for (const record of records) {
      const id = String(record?.id || "").trim();
      if (!id) {
        errors.push(`${filename}: ontology entry is missing id`);
        continue;
      }
      if (seen.has(id)) {
        errors.push(`${filename}: duplicate ontology id \`${id}\``);
        continue;
      }
      seen.add(id);
      index.set(id, record);
    }

    if (field === "proofs") {
      for (const proof of records) {
        for (const relationField of ontologyFields.filter((entry) => entry !== "proofs")) {
          for (const relationId of normalizeStringArray(proof?.[relationField])) {
            if (!indexes[relationField]?.has(relationId)) {
              errors.push(
                `${filename}: proof \`${proof.id}\` references unknown ${relationField.slice(0, -1)} id \`${relationId}\``
              );
            }
          }
        }
      }
    }

    bundle[field] = records;
    indexes[field] = index;
  }

  return { bundle, indexes, errors };
}

function validateMeta(meta, body, sourceName, ontologyIndexes) {
  const errors = [];
  const sourceSlug = String(meta?.slug || sourceName).trim();
  const normalizedLane = normalizeLane(meta?.lane || "");
  const verification = normalizeVerification(meta?.verification);

  if (!meta || typeof meta !== "object") {
    errors.push("Missing metadata object.");
    return errors.map((error) => `${sourceName}: ${error}`);
  }

  if (!sourceSlug) errors.push("Missing `slug`.");
  if (!String(meta.title || "").trim()) errors.push("Missing `title`.");
  if (!String(meta.summary || "").trim()) errors.push("Missing `summary`.");
  if (!String(meta.category || "").trim()) errors.push("Missing `category`.");
  if (!String(meta.lane || "").trim()) errors.push("Missing `lane`.");
  if (!String(body || "").trim()) errors.push("Missing source body text.");

  if (meta.category && !allowedCategories.has(String(meta.category).trim())) {
    errors.push(`Invalid category \`${meta.category}\`.`);
  }

  if (normalizedLane && !allowedLanes.has(normalizedLane)) {
    errors.push(`Invalid lane \`${meta.lane}\`.`);
  }

  if (!Array.isArray(meta.tags)) errors.push("`tags` must be an array.");
  if (!Array.isArray(meta.claims || [])) errors.push("`claims` must be an array.");
  if (!Array.isArray(meta.proof_points || [])) errors.push("`proof_points` must be an array.");

  if (!String(verification.status || "").trim()) {
    errors.push("Missing `verification.status`.");
  }

  for (const field of ontologyFields) {
    const values = normalizeStringArray(meta?.[field]);
    for (const value of values) {
      if (!ontologyIndexes[field]?.has(value)) {
        errors.push(`${sourceSlug}: invalid field \`${field}\` references unknown ontology id \`${value}\``);
      }
    }
  }

  return errors.map((error) => `${sourceName}: ${error}`);
}

function buildNormalizedRecord(baseName, sourceFilename, ontologyIndexes, proofsBySlug) {
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
  const errors = validateMeta(meta, body, sourceFilename, ontologyIndexes);
  const verification = normalizeVerification(meta.verification);
  const slug = String(meta.slug || "").trim();
  const metadataProofs = normalizeStringArray(meta.proofs);
  const relatedProofs = normalizeStringArray([
    ...metadataProofs,
    ...(proofsBySlug.get(slug) || []),
  ]);
  const relatedProofObjects = relatedProofs
    .map((proofId) => ontologyIndexes.proofs.get(proofId))
    .filter(Boolean);

  const normalized = {
    slug,
    title: String(meta.title || "").trim(),
    category: String(meta.category || "").trim(),
    source_type: String(meta.source_type || "paste").trim(),
    source_uri: String(meta.source_uri || "").trim() || null,
    summary: String(meta.summary || "").trim(),
    body,
    metadata: {
      lane: normalizeLane(meta.lane || ""),
      original_lane: String(meta.lane || "").trim(),
      tags: normalizeStringArray(meta.tags),
      verification,
      verification_status: verification.status,
      claims: Array.isArray(meta.claims) ? meta.claims : [],
      proof_points: Array.isArray(meta.proof_points) ? meta.proof_points : [],
      regions: normalizeStringArray(meta.regions),
      companies: normalizeStringArray(meta.companies),
      impact_score: Number.isFinite(Number(meta.impact_score))
        ? Number(meta.impact_score)
        : 0,
      priority_label: String(meta.priority_label || "").trim() || "standard",
      source_filename: sourceFilename,
      source_meta_filename: `${baseName}.meta.json`,
      reviewed_at: verification.reviewed_at || "",
      problems: normalizeStringArray(meta.problems),
      principles: normalizeStringArray(meta.principles),
      capabilities: normalizeStringArray(meta.capabilities),
      outcomes: normalizeStringArray(meta.outcomes),
      governance: normalizeStringArray(meta.governance),
      industries: normalizeStringArray(meta.industries),
      proofs: metadataProofs,
      related_proofs: relatedProofs,
      enterprise_scale_score: relatedProofObjects.reduce(
        (max, proof) => Math.max(max, Number(proof?.impact_score || 0)),
        0
      ),
      measurable_outcome_count: normalizeStringArray(meta.outcomes).filter((outcomeId) =>
        [
          "revenue_growth",
          "higher_adoption",
          "faster_decisions",
          "lower_risk",
          "cost_reduction",
          "productivity_gains",
          "faster_time_to_value",
        ].includes(outcomeId)
      ).length,
    },
  };

  return { errors, record: normalized };
}

function validateProofSourceSlugs(proofs, slugSet) {
  const errors = [];
  const proofsBySlug = new Map();

  for (const proof of proofs) {
    for (const sourceSlug of normalizeStringArray(proof?.source_slugs)) {
      if (!slugSet.has(sourceSlug)) {
        errors.push(`proofs.json: proof \`${proof.id}\` references unknown source slug \`${sourceSlug}\``);
        continue;
      }
      const current = proofsBySlug.get(sourceSlug) || [];
      current.push(proof.id);
      proofsBySlug.set(sourceSlug, current);
    }
  }

  return { errors, proofsBySlug };
}

function main() {
  ensureDir(normalizedDir);
  ensureDir(publishedDir);

  const { bundle: ontologyBundle, indexes: ontologyIndexes, errors } = loadOntologyBundle();
  const sourceFiles = listSourceFiles();
  const slugSet = new Set();

  for (const sourceFilename of sourceFiles) {
    const metaPath = path.join(inboxDir, `${getBaseName(sourceFilename)}.meta.json`);
    if (!fs.existsSync(metaPath)) continue;
    const slug = String(readJson(metaPath)?.slug || "").trim();
    if (!slug) continue;
    if (slugSet.has(slug)) {
      errors.push(`${sourceFilename}: duplicate source slug \`${slug}\``);
    }
    slugSet.add(slug);
  }

  const { errors: proofSlugErrors, proofsBySlug } = validateProofSourceSlugs(
    ontologyBundle.proofs || [],
    slugSet
  );
  errors.push(...proofSlugErrors);

  const records = [];

  for (const sourceFilename of sourceFiles) {
    const baseName = getBaseName(sourceFilename);
    const { errors: itemErrors, record } = buildNormalizedRecord(
      baseName,
      sourceFilename,
      ontologyIndexes,
      proofsBySlug
    );
    errors.push(...itemErrors);
    if (!record) continue;

    writeJson(path.join(normalizedDir, `${baseName}.json`), record);
    records.push(record);
  }

  const generatedAt = new Date().toISOString();
  const published = {
    generated_at: generatedAt,
    counts: {
      source_files: sourceFiles.length,
      normalized_records: records.length,
      verified_records: records.filter(
        (record) => record.metadata.verification_status === "verified"
      ).length,
      ontology_entities: Object.entries(ontologyBundle).reduce(
        (total, [, value]) => total + value.length,
        0
      ),
      proofs: ontologyBundle.proofs.length,
      errors: errors.length,
    },
    ontology_status: errors.length ? "failed" : "ok",
    records,
  };

  writeJson(path.join(publishedDir, "joz-documents.generated.json"), published);
  writeJson(path.join(publishedDir, "joz-ontology.generated.json"), ontologyBundle);
  writeJson(path.join(publishedDir, "joz-knowledge-report.json"), {
    generated_at: generatedAt,
    counts: published.counts,
    ontology_counts: Object.fromEntries(
      Object.entries(ontologyBundle).map(([key, value]) => [key, value.length])
    ),
    ontology_status: published.ontology_status,
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
    `Built ${records.length} Joz knowledge record(s) and ${ontologyBundle.proofs.length} proof object(s).`
  );
}

main();
