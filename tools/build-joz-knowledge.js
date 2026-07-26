import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mapJozQueryToOntology } from "../shared/jozOntology.js";
import {
  buildDatasetControlManifest,
  buildGovernanceMetadata,
  JOZ_PUBLIC_DATASET_ID,
  JOZ_PUBLIC_TENANT_ID,
} from "../shared/jozDataGovernance.js";

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
const canonicalDir = path.join(dataRoot, "canonical");
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
  "project",
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

const MODEL_READY_STATUSES = new Set([
  "verified",
  "cv_supported",
  "project_supported",
  "capability_supported",
  "positioning_supported",
  "framework_supported",
  "cv_and_project_supported",
]);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonLines(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${path.basename(filePath)}:${index + 1} invalid JSONL record`);
      }
    });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function pruneStaleNormalizedRecords(activeFilenames) {
  if (!fs.existsSync(normalizedDir)) return;
  const active = new Set(activeFilenames);
  for (const filename of fs.readdirSync(normalizedDir)) {
    if (!filename.endsWith(".json") || active.has(filename)) continue;
    fs.rmSync(path.join(normalizedDir, filename));
  }
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

function normalizeScalar(value) {
  const text = String(value || "").trim();
  return text || null;
}

function slugify(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCanonicalSlug(rawRecord = {}, sourceFilename = "") {
  const titleSlug = slugify(rawRecord?.title || rawRecord?.id || "");
  const sourceSlug = slugify(getBaseName(sourceFilename));
  return `canonical-${sourceSlug}-${titleSlug}`;
}

function firstParagraph(text = "") {
  return String(text || "")
    .trim()
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, " ")
    .trim();
}

function buildSummary(text = "", maxLength = 220) {
  const paragraph = firstParagraph(text);
  if (!paragraph) return "";
  if (paragraph.length <= maxLength) return paragraph;
  return `${paragraph.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeCanonicalPriority(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (["hero", "high", "standard", "supporting"].includes(normalized)) {
    return normalized;
  }
  return "standard";
}

function buildSemanticText(title = "", content = "", tags = []) {
  const joinedTags = normalizeStringArray(tags).join(" ");
  return [title, title, joinedTags, joinedTags, content].filter(Boolean).join("\n");
}

function inferCanonicalLane(record = {}) {
  const haystack = [record.title, ...(record.tags || []), record.content].join(" ").toLowerCase();

  if (
    /(langgraph|temporal|fastapi|mcp|tools|api|backend|rag|retrieval|knowledge graph|knowledge layer|memory|models|golang|python|docker|containers|kubernetes|pod|deployment|service|ingress|load balancer|autoscaling|stateless|postgresql|redis|cache|kafka|nats|event-driven|queues|workers|vault|kms|workload identity|opentelemetry|prometheus|grafana|langsmith|ci\/cd|terraform|gitops|canary|circuit breaker|idempotency|backpressure|disaster recovery|infrastructure|observability|scalability)/i.test(
      haystack
    )
  ) {
    return "skills";
  }

  if (/(positioning|implementation|how joz builds|platform|roadmap|organisational awareness layer|autonomous execution layer|organisational intelligence integration)/i.test(haystack)) {
    return "business_need";
  }

  if (
    /(risk|verification|security|prompt injection|guardrails|sandbox|human approval|permissions|acl|sensitive data|trust|policy|approval)/i.test(
      haystack
    )
  ) {
    return "systems_mindset";
  }

  return "skills";
}

function inferCanonicalIntentFamilies(record = {}, lane = "skills") {
  const haystack = [record.title, ...(record.tags || []), record.content].join(" ").toLowerCase();
  const families = new Set([lane]);

  if (/(architecture|orchestration|langgraph|temporal|fastapi|mcp|rag|retrieval|knowledge|memory|observability|infrastructure|python|golang|docker|kubernetes|postgresql|redis|kafka|nats|terraform|gitops|opentelemetry|vault|workload identity|scalability)/i.test(haystack)) {
    families.add("skills");
  }
  if (/(risk|verification|security|acl|permissions|prompt injection|guardrails|trust|approval|sensitive data|policy)/i.test(haystack)) {
    families.add("systems_mindset");
  }
  if (/(business|organisational awareness|execution layer|implementation|approach|builds|platform)/i.test(haystack)) {
    families.add("business_need");
  }

  return [...families];
}

function inferCanonicalSubIntents(record = {}) {
  const haystack = [record.title, ...(record.tags || []), record.content].join(" ").toLowerCase();
  const subIntents = new Set();

  if (/agent definition|\bagent\b/i.test(haystack)) subIntents.add("agent_definition");
  if (/(orchestration|langgraph|temporal|workflow)/i.test(haystack)) subIntents.add("orchestration");
  if (/(fastapi|api layer|backend api)/i.test(haystack)) subIntents.add("fastapi");
  if (/\bmcp\b/i.test(haystack)) subIntents.add("mcp");
  if (/(rag|retrieval|knowledge graph|knowledge layer|pgvector)/i.test(haystack)) subIntents.add("retrieval");
  if (/(acl|permissions)/i.test(haystack)) subIntents.add("acl");
  if (/(risk|verification|approval|guardrails|prompt injection|security)/i.test(haystack)) subIntents.add("governance");
  if (/(python|golang|infrastructure|scalability|observability|docker|kubernetes|postgresql|redis|kafka|nats|terraform|gitops|opentelemetry|vault|workload identity)/i.test(haystack)) subIntents.add("technical_stack");
  if (/(blockchain|defi|wallet|smart contract|signing)/i.test(haystack)) subIntents.add("blockchain");
  if (/(organisational awareness|organisational intelligence|autonomous execution)/i.test(haystack)) subIntents.add("system_architecture");

  return [...subIntents];
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

function listCanonicalJsonlFiles() {
  if (!fs.existsSync(canonicalDir)) return [];
  return fs
    .readdirSync(canonicalDir)
    .filter((name) => name.endsWith(".jsonl"))
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
  if (!Array.isArray(meta.projects || [])) errors.push("`projects` must be an array.");
  if (!Array.isArray(meta.intent_families || [])) errors.push("`intent_families` must be an array.");
  if (!Array.isArray(meta.sub_intents || [])) errors.push("`sub_intents` must be an array.");

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
      projects: normalizeStringArray(meta.projects),
      intent_families: normalizeStringArray(meta.intent_families),
      sub_intents: normalizeStringArray(meta.sub_intents),
      impact_score: Number.isFinite(Number(meta.impact_score))
        ? Number(meta.impact_score)
        : 0,
      priority_label: String(meta.priority_label || "").trim() || "standard",
      valid_from: normalizeScalar(meta.valid_from),
      valid_to: normalizeScalar(meta.valid_to),
      source_notes: normalizeScalar(meta.source_notes),
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

  normalized.metadata = buildGovernanceMetadata({
    metadata: normalized.metadata,
    body,
    sourceFilename,
    sourceUri: normalized.source_uri,
    verificationStatus: normalized.metadata.verification_status,
    datasetId: meta.dataset_id || JOZ_PUBLIC_DATASET_ID,
    tenantId: meta.tenant_id || JOZ_PUBLIC_TENANT_ID,
  });
  normalized.source_uri = normalized.metadata.source_uri;

  return { errors, record: normalized };
}

function buildCanonicalRecord(rawRecord, sourceFilename, generatedAt = "") {
  const errors = [];
  const id = String(rawRecord?.id || "").trim();
  const title = String(rawRecord?.title || "").trim();
  const content = String(rawRecord?.content || "").trim();
  const source = String(rawRecord?.source || "").trim();
  const tags = normalizeStringArray(rawRecord?.tags);
  const priorityLabel = normalizeCanonicalPriority(rawRecord?.priority);

  if (!id) errors.push(`${sourceFilename}: canonical record missing id`);
  if (!title) errors.push(`${sourceFilename}: canonical record missing title`);
  if (!content) errors.push(`${sourceFilename}: canonical record missing content`);
  if (!source) errors.push(`${sourceFilename}: canonical record missing source`);
  if (!Array.isArray(rawRecord?.tags)) {
    errors.push(`${sourceFilename}: canonical record tags must be an array`);
  }

  const lane = inferCanonicalLane(rawRecord);
  const semanticText = buildSemanticText(title, content, tags);
  const ontologyFields = mapJozQueryToOntology(semanticText);
  const slug = buildCanonicalSlug(rawRecord, sourceFilename);

  const normalized = {
    errors,
    record: {
      slug,
      title,
      category: lane,
      source_type: "canonical_jsonl",
      source_uri: `data/joz/canonical/${sourceFilename}#${id}`,
      summary: buildSummary(content, 220),
      body: content,
      metadata: {
        lane,
        original_lane: lane,
        tags,
        verification: {
          status: "framework_supported",
          reviewed_by: "codex",
          reviewed_at: generatedAt,
          notes: "Canonical JSONL knowledge ingest",
        },
        verification_status: "framework_supported",
        claims: [],
        proof_points: [],
        regions: [],
        companies: [],
        projects: [],
        intent_families: inferCanonicalIntentFamilies(rawRecord, lane),
        sub_intents: inferCanonicalSubIntents(rawRecord),
        impact_score: priorityLabel === "hero" ? 96 : priorityLabel === "high" ? 82 : 68,
        priority_label: priorityLabel,
        valid_from: null,
        valid_to: null,
        source_notes: source,
        source_filename: sourceFilename,
        source_meta_filename: null,
        reviewed_at: generatedAt,
        problems: ontologyFields.problems,
        principles: ontologyFields.principles,
        capabilities: ontologyFields.capabilities,
        outcomes: ontologyFields.outcomes,
        governance: ontologyFields.governance,
        industries: ontologyFields.industries,
        proofs: [],
        related_proofs: [],
        enterprise_scale_score: 0,
        measurable_outcome_count: 0,
        canonical_record: true,
        canonical_record_id: id,
        canonical_record_title: title,
        canonical_record_source: source,
        canonical_record_priority: priorityLabel,
        canonical_record_tags: tags,
        source_authority: source === "Joz canonical knowledge" ? 24 : 12,
        semantic_text: semanticText,
        keyword_terms: normalizeStringArray([
          ...title.toLowerCase().split(/[^a-z0-9]+/),
          ...tags.map((tag) => String(tag || "").toLowerCase()),
        ]).filter((term) => term.length > 1),
        exact_phrases: normalizeStringArray([title, ...tags]),
      },
    },
  };

  normalized.record.metadata = buildGovernanceMetadata({
    metadata: normalized.record.metadata,
    body: content,
    sourceFilename,
    sourceUri: normalized.record.source_uri,
    verificationStatus: "framework_supported",
    datasetId: JOZ_PUBLIC_DATASET_ID,
    tenantId: JOZ_PUBLIC_TENANT_ID,
  });
  normalized.record.source_uri = normalized.record.metadata.source_uri;

  return normalized;
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
  const canonicalFiles = listCanonicalJsonlFiles();
  const generatedAt = new Date().toISOString();
  const slugSet = new Set();
  const activeNormalizedFilenames = [];

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

  for (const canonicalFilename of canonicalFiles) {
    const canonicalPath = path.join(canonicalDir, canonicalFilename);
    for (const rawRecord of readJsonLines(canonicalPath)) {
      const slug = buildCanonicalSlug(rawRecord, canonicalFilename);
      if (!slug) continue;
      if (slugSet.has(slug)) {
        errors.push(`${canonicalFilename}: duplicate canonical slug \`${slug}\``);
      }
      slugSet.add(slug);
    }
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

    const normalizedFilename = `${baseName}.json`;
    writeJson(path.join(normalizedDir, normalizedFilename), record);
    activeNormalizedFilenames.push(normalizedFilename);
    records.push(record);
  }

  for (const canonicalFilename of canonicalFiles) {
    const canonicalPath = path.join(canonicalDir, canonicalFilename);
    for (const rawRecord of readJsonLines(canonicalPath)) {
      const { errors: itemErrors, record } = buildCanonicalRecord(
        rawRecord,
        canonicalFilename,
        generatedAt
      );
      errors.push(...itemErrors);
      if (!record) continue;

      const normalizedFilename = `${record.slug}.json`;
      writeJson(path.join(normalizedDir, normalizedFilename), record);
      activeNormalizedFilenames.push(normalizedFilename);
      records.push(record);
    }
  }

  pruneStaleNormalizedRecords(activeNormalizedFilenames);

  const modelReadyRecords = records.filter((record) =>
    MODEL_READY_STATUSES.has(record.metadata.verification_status)
  );
  const published = {
    generated_at: generatedAt,
    counts: {
      source_files: sourceFiles.length + canonicalFiles.length,
      canonical_source_files: canonicalFiles.length,
      normalized_records: records.length,
      model_ready_records: modelReadyRecords.length,
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
    model_ready_records: modelReadyRecords,
  };

  writeJson(path.join(publishedDir, "joz-documents.generated.json"), published);
  writeJson(
    path.join(publishedDir, "joz-dataset-manifest.json"),
    buildDatasetControlManifest({
      generatedAt,
      records,
      sourceCount: sourceFiles.length + canonicalFiles.length,
      canonicalSourceCount: canonicalFiles.length,
      errors: errors.length,
      datasetId: JOZ_PUBLIC_DATASET_ID,
      tenantId: JOZ_PUBLIC_TENANT_ID,
    })
  );
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
