import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const WORLD_MODEL_DATASET_ID = "joz-world-model-knowledge-v1";
export const WORLD_MODEL_RUNTIME_DATASET_ID = "joz-public-knowledge";
export const STANFORD_HAI_SOURCE_URL =
  "https://hai.stanford.edu/assets/files/hai-issue-brief-the-world-model-and-spatial-intelligence-era.pdf";
export const STANFORD_HAI_SOURCE_TITLE =
  "The World Model and Spatial Intelligence Era: Governing AI Beyond Language";

const CLAIM_SCOPES = new Set([
  "source_grounded",
  "joz_verified_report",
  "joz_positioning",
  "mandatory_boundary",
]);
const RECORD_TYPES = new Set([
  "canonical_qa",
  "knowledge_chunk",
  "joz_implementation",
  "claim_boundary",
  "positioning",
  "response_policy",
  "pdf_evidence",
]);
const PDF_CHUNK_PAGE_RANGES = [
  [1],
  [2],
  [3, 4],
  [5],
  [6],
  [7],
  [8],
  [9],
  [10],
  [11],
  [12, 13, 14],
  [15, 16],
];

function resolveRepoRoot() {
  const candidates = [
    process.cwd(),
    path.resolve(__dirname, ".."),
  ];
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, "data"))) || candidates[0];
}

const repoRoot = resolveRepoRoot();
const datasetPath = path.join(repoRoot, "data", "knowledge", `${WORLD_MODEL_DATASET_ID}.jsonl`);
const pdfPath = path.join(
  repoRoot,
  "data",
  "knowledge",
  "sources",
  "stanford-hai-world-model-spatial-intelligence-2026.pdf"
);
const pdfPagesPath = path.join(
  repoRoot,
  "data",
  "knowledge",
  "sources",
  "stanford-hai-world-model-spatial-intelligence-2026.pages.jsonl"
);

function cleanText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normaliseArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => cleanText(item)).filter(Boolean))]
    : [];
}

function slugify(value = "") {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sha256(filePath) {
  return fs.existsSync(filePath)
    ? crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")
    : null;
}

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`${path.basename(filePath)}:${index + 1} invalid JSONL`);
      }
    });
}

function sourceMetadata(source = {}) {
  return {
    title: cleanText(source.title) || STANFORD_HAI_SOURCE_TITLE,
    publisher: cleanText(source.publisher) || "Stanford HAI",
    date: cleanText(source.date) || "2026-07",
    pages: Array.isArray(source.pages)
      ? source.pages.map((page) => Number(page)).filter(Number.isInteger)
      : [],
    uri: STANFORD_HAI_SOURCE_URL,
  };
}

function scopeStatus(claimScope) {
  if (claimScope === "source_grounded") return "verified";
  if (claimScope === "joz_verified_report") return "verified";
  if (claimScope === "joz_positioning") return "positioning_supported";
  return "verified";
}

function scopeAuthority(claimScope) {
  if (claimScope === "mandatory_boundary") return 70;
  if (claimScope === "joz_verified_report") return 62;
  if (claimScope === "source_grounded") return 58;
  if (claimScope === "joz_positioning") return 40;
  return 20;
}

function retrievalPriority(recordType, claimScope) {
  if (claimScope === "mandatory_boundary" || recordType === "response_policy") return 100;
  if (claimScope === "joz_verified_report") return 90;
  if (claimScope === "source_grounded") return 75;
  if (claimScope === "joz_positioning") return 60;
  return 20;
}

function isJozSpecificQuery(query = "") {
  return /\b(?:joz|exocortex|interactive ai twin|joz maxx|joz ai)\b/i.test(String(query));
}

export function isWorldModelQuery(query = "") {
  return /\b(?:world models?|world-models?|spatial intelligence|spatial ai|counterfactual|next state|action[ -]conditioned|simulation[- ]to[- ]reality|renderers?|simulators?|planners?|object permanence|spatial privacy|exocortex|transition learning|agents? (?:are )?obsolete|agents? (?:are )?outdated|realistic generated|benchmark scores|stanford paper validates|continuously observe|autonomously controls|autonomous controls|camera|metaverse)\b/i.test(String(query));
}

export function getWorldModelQueryProfile(query = "") {
  return {
    isWorldModel: isWorldModelQuery(query),
    isJozSpecific: isJozSpecificQuery(query),
  };
}

export function getWorldModelBoundaryCorrection(query = "") {
  const clean = normaliseQuestion(query);
  if (/stanford paper validates joz|stanford.*validate.*exocortex|paper proves joz/i.test(clean)) {
    return "No. The Stanford HAI paper is an external research and governance source. It supports general world-model concepts and claim boundaries, but it does not validate Joz Exocortex implementation facts; those come from the separate Joz implementation record.";
  }
  if (/zero guardrail|completely safe|proves.*safe|guaranteed safe/i.test(clean)) {
    return "No. Passing guardrail tests is evidence about those test cases, not proof that the system is completely safe. Safety still depends on coverage, deployment conditions, independent evaluation and observed outcomes.";
  }
  if (/benchmark scores prove physical safety|benchmark.*physical safety/i.test(clean)) {
    return "No. Benchmark scores can measure selected capabilities, but they do not by themselves prove physical safety or reliable deployment. Evaluation must match the operational function, conditions and consequences.";
  }
  if (/spatial intelligence.*(?:just|means).*metaverse|metaverse.*spatial intelligence/i.test(clean)) {
    return "No. Spatial intelligence means maintaining an understanding of environments and relationships over time and using it to guide action. It is broader than metaverse or 3D-content development.";
  }
  return null;
}

function cleanPdfPageText(value = "") {
  const repeatedFurniture = new Set([
    "Issue Brief",
    STANFORD_HAI_SOURCE_TITLE,
    "HAI Policy & Society",
    "July 2026",
  ]);
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter((line) => line && !/^\d+$/.test(line) && !repeatedFurniture.has(line))
    .join("\n")
    .trim();
}

function buildSemanticText(question, answer, shortAnswer, keywords = []) {
  return [question, shortAnswer, keywords.join(" "), answer].filter(Boolean).join("\n");
}

function buildWorldModelRecord(raw = {}) {
  const id = cleanText(raw.id);
  const recordType = cleanText(raw.record_type).toLowerCase();
  const claimScope = cleanText(raw.claim_scope).toLowerCase();
  const question = cleanText(raw.question);
  const answer = cleanText(raw.answer);
  const shortAnswer = cleanText(raw.short_answer) || answer;
  const keywords = normaliseArray(raw.keywords);
  const source = sourceMetadata(raw.source);
  const sourceUri = source.pages.length
    ? STANFORD_HAI_SOURCE_URL
    : `source://joz/${WORLD_MODEL_DATASET_ID}/implementation`;
  const jozRecord = claimScope.startsWith("joz_") || recordType === "claim_boundary" || recordType === "response_policy";
  const semanticText = buildSemanticText(question, answer, shortAnswer, keywords);

  return {
    slug: `wm-${slugify(id)}`,
    title: question || cleanText(raw.topic).replace(/_/g, " "),
    category: "world_model",
    source_type: "world_model_jsonl",
    source_uri: sourceUri,
    summary: shortAnswer,
    body: answer,
    metadata: {
      lane: "skills",
      original_lane: "skills",
      tags: keywords,
      verification: {
        status: scopeStatus(claimScope),
        reviewed_by: "world-model-knowledge-v1",
        reviewed_at: "2026-07-30",
        notes: `World-model ${claimScope} record`,
      },
      verification_status: scopeStatus(claimScope),
      evidence_tier: claimScope === "source_grounded" ? "verified_fact" : "supported_claim",
      claims: [shortAnswer],
      proof_points: [],
      regions: [],
      companies: [],
      projects: [],
      intent_families: jozRecord ? ["skills", "systems_mindset"] : ["skills"],
      sub_intents: [cleanText(raw.topic)],
      impact_score: claimScope === "mandatory_boundary" ? 100 : 80,
      priority_label: claimScope === "mandatory_boundary" ? "hero" : "high",
      valid_from: null,
      valid_to: null,
      source_notes: source.title,
      source_filename: `${WORLD_MODEL_DATASET_ID}.jsonl`,
      source_meta_filename: null,
      reviewed_at: "2026-07-30",
      problems: [],
      principles: [],
      capabilities: ["spatial_ai", "verification", "ai_governance"],
      outcomes: [],
      governance: claimScope === "mandatory_boundary" ? ["data_boundaries", "human_approval"] : ["source_provenance"],
      industries: [],
      proofs: [],
      related_proofs: [],
      enterprise_scale_score: 0,
      measurable_outcome_count: 0,
      source_authority: scopeAuthority(claimScope),
      semantic_text: semanticText,
      keyword_terms: normaliseArray([
        ...question.toLowerCase().split(/[^a-z0-9]+/),
        ...keywords.map((keyword) => keyword.toLowerCase()),
        cleanText(raw.topic).replace(/_/g, " ").toLowerCase(),
      ]).filter((term) => term.length > 1),
      exact_phrases: normaliseArray([question, ...keywords]),
      dataset_id: WORLD_MODEL_RUNTIME_DATASET_ID,
      knowledge_dataset_id: WORLD_MODEL_DATASET_ID,
      knowledge_version: WORLD_MODEL_DATASET_ID,
      record_id: id,
      record_type: recordType,
      topic: cleanText(raw.topic),
      claim_scope: claimScope,
      source_id: claimScope === "source_grounded" ? "stanford-hai-world-model-spatial-intelligence-2026" : "joz-world-model-implementation",
      source_key: `${WORLD_MODEL_DATASET_ID}#${id}`,
      source_title: source.title,
      source_publisher: source.publisher,
      source_date: source.date,
      source_pages: source.pages,
      source_uri: sourceUri,
      retrieval_priority: retrievalPriority(recordType, claimScope),
      boundary_record: claimScope === "mandatory_boundary",
      policy_record: recordType === "response_policy",
      world_model_record: true,
      joz_specific: jozRecord,
      citation_label: source.pages.length ? `${source.title}, p. ${source.pages.join(", ")}` : source.title,
    },
  };
}

function buildPdfEvidenceRecords() {
  const pages = readJsonLines(pdfPagesPath);
  if (!pages.length) return [];
  const byPage = new Map(pages.map((page) => [Number(page.page), page]));
  return PDF_CHUNK_PAGE_RANGES.map((pageNumbers, index) => {
    const text = pageNumbers.map((page) => cleanPdfPageText(byPage.get(page)?.text || "")).filter(Boolean).join("\n\n");
    const chunkId = `stanford-hai-world-model-2026-chunk-${String(index + 1).padStart(3, "0")}`;
    const pageLabel = pageNumbers.length === 1 ? `p. ${pageNumbers[0]}` : `pp. ${pageNumbers[0]}–${pageNumbers.at(-1)}`;
    return {
      slug: `wm-pdf-${String(index + 1).padStart(3, "0")}`,
      title: `${STANFORD_HAI_SOURCE_TITLE} (${pageLabel})`,
      category: "world_model",
      source_type: "stanford_hai_pdf",
      source_uri: STANFORD_HAI_SOURCE_URL,
      summary: cleanText(text.split(/\n\s*\n/)[0]).slice(0, 420),
      body: text,
      metadata: {
        lane: "skills",
        original_lane: "skills",
        tags: ["world model", "spatial intelligence", "Stanford HAI", "source evidence"],
        verification: {
          status: "framework_supported",
          reviewed_by: "stanford-hai-source-ingest",
          reviewed_at: "2026-07-30",
          notes: "Page-aware source evidence derived from the official Stanford HAI PDF",
        },
        verification_status: "framework_supported",
        evidence_tier: "framework_guidance",
        claims: [],
        proof_points: [],
        regions: [],
        companies: [],
        projects: [],
        intent_families: ["skills", "systems_mindset"],
        sub_intents: ["world_model_source_evidence"],
        impact_score: 70,
        priority_label: "standard",
        valid_from: null,
        valid_to: null,
        source_notes: `${STANFORD_HAI_SOURCE_TITLE}; ${pageLabel}`,
        source_filename: path.basename(pdfPath),
        source_meta_filename: null,
        reviewed_at: "2026-07-30",
        problems: [],
        principles: [],
        capabilities: ["spatial_ai", "ai_governance", "evaluation"],
        outcomes: [],
        governance: ["source_provenance", "evaluation", "data_boundaries"],
        industries: [],
        proofs: [],
        related_proofs: [],
        enterprise_scale_score: 0,
        measurable_outcome_count: 0,
        source_authority: 58,
        semantic_text: text,
        keyword_terms: ["world", "model", "spatial", "intelligence", "stanford", "hai", "simulation", "governance"],
        exact_phrases: [STANFORD_HAI_SOURCE_TITLE],
        dataset_id: WORLD_MODEL_RUNTIME_DATASET_ID,
        knowledge_dataset_id: WORLD_MODEL_DATASET_ID,
        knowledge_version: WORLD_MODEL_DATASET_ID,
        record_id: chunkId,
        record_type: "pdf_evidence",
        topic: "stanford_hai_source_evidence",
        claim_scope: "source_grounded",
        source_id: "stanford-hai-world-model-spatial-intelligence-2026",
        source_key: `${WORLD_MODEL_DATASET_ID}#${chunkId}`,
        source_title: STANFORD_HAI_SOURCE_TITLE,
        source_publisher: "Stanford HAI",
        source_date: "2026-07",
        source_pages: pageNumbers,
        source_uri: STANFORD_HAI_SOURCE_URL,
        source_checksum: sha256(pdfPath),
        retrieval_priority: 75,
        boundary_record: false,
        policy_record: false,
        world_model_record: true,
        joz_specific: false,
        citation_label: `${STANFORD_HAI_SOURCE_TITLE}, ${pageLabel}`,
        pdf_chunk_id: chunkId,
      },
    };
  });
}

export function validateWorldModelKnowledge({ includePdf = true } = {}) {
  const records = readJsonLines(datasetPath);
  const errors = [];
  const ids = new Set();
  for (const [index, record] of records.entries()) {
    const prefix = `record ${index + 1}`;
    if (!cleanText(record?.id)) errors.push(`${prefix}: missing id`);
    if (ids.has(record.id)) errors.push(`${prefix}: duplicate id ${record.id}`);
    ids.add(record.id);
    if (!RECORD_TYPES.has(cleanText(record?.record_type).toLowerCase())) errors.push(`${prefix}: unsupported record_type`);
    if (!cleanText(record?.topic)) errors.push(`${prefix}: missing topic`);
    if (!cleanText(record?.question)) errors.push(`${prefix}: missing question`);
    if (!cleanText(record?.answer)) errors.push(`${prefix}: missing answer`);
    if (!CLAIM_SCOPES.has(cleanText(record?.claim_scope).toLowerCase())) errors.push(`${prefix}: unsupported claim_scope`);
    if (!Array.isArray(record?.keywords)) errors.push(`${prefix}: keywords must be an array`);
    if (!record?.source?.title || !record?.source?.publisher || !Array.isArray(record?.source?.pages)) {
      errors.push(`${prefix}: incomplete source metadata`);
    }
  }
  if (records.length !== 44) errors.push(`expected 44 JSONL records, found ${records.length}`);
  if (includePdf && (!fs.existsSync(pdfPath) || !fs.existsSync(pdfPagesPath))) {
    errors.push("Stanford HAI PDF and page-aware derived extraction are required");
  }
  return {
    ok: errors.length === 0,
    errors,
    recordCount: records.length,
    uniqueIdCount: ids.size,
    pdfPageCount: includePdf ? readJsonLines(pdfPagesPath).length : 0,
    datasetChecksum: sha256(datasetPath),
    pdfChecksum: sha256(pdfPath),
  };
}

export function loadWorldModelKnowledgeRecords({ includePdf = true } = {}) {
  const validation = validateWorldModelKnowledge({ includePdf });
  if (!validation.ok) throw new Error(validation.errors.join("; "));
  const records = readJsonLines(datasetPath).map(buildWorldModelRecord);
  return includePdf ? [...records, ...buildPdfEvidenceRecords()] : records;
}

function normaliseQuestion(value = "") {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const WORLD_MODEL_QUERY_HINTS = [
  ["wm-paper-006", ["renderers", "simulators", "planners", "functional categories", "three categories"]],
  ["wm-paper-004", ["counterfactual", "action-conditioned", "what happens if", "possible consequences"]],
  ["wm-paper-012", ["object permanence", "coherent environment", "scene consistency"]],
  ["wm-paper-013", ["realistic generated", "visual realism", "look realistic", "valid world model"]],
  ["wm-paper-014", ["simulation to reality", "simulation-reality", "transfer gap", "reality gap"]],
  ["wm-paper-015", ["how should world models be evaluated", "evaluate world models", "world model evaluation"]],
  ["wm-paper-018", ["spatial privacy", "inferred profiles", "privacy"]],
  ["wm-paper-020", ["what should world model systems log", "document perception", "perception and action"]],
  ["joz-wm-009", ["neural", "foundation", "deepmind", "frontier", "physical simulator"]],
  ["joz-wm-010", ["autonomously", "autonomous", "control live", "live action", "controls the application", "guardrail"]],
  ["joz-wm-011", ["camera", "audio", "lidar", "radar", "biometric", "physical world", "sees everything", "ar anchor"]],
  ["joz-wm-012", ["rag", "retrieval", "same thing", "beyond rag"]],
  ["joz-wm-013", ["agent obsolete", "agents obsolete", "agents are obsolete", "agents outdated", "agents are outdated", "beyond agents", "agents old"]],
  ["joz-wm-014", ["why exocortex", "exocortex mean", "call it an exocortex"]],
  ["joz-wm-004", ["shadow mode", "shadow"]],
  ["joz-wm-005", ["transition learning", "learn from", "prediction error", "experience updates"]],
  ["joz-wm-001", ["joz exocortex", "what is exocortex", "interactive ai twin"]],
];

export function findWorldModelKnowledgeRecord(query = "", { jozOnly = false } = {}) {
  const clean = normaliseQuestion(query);
  if (!isWorldModelQuery(clean)) return null;
  const records = loadWorldModelKnowledgeRecords({ includePdf: false });
  const jozSpecific = isJozSpecificQuery(clean);

  for (const [id, hints] of WORLD_MODEL_QUERY_HINTS) {
    if (hints.some((hint) => clean.includes(hint)) && (!jozOnly || id.startsWith("joz-"))) {
      const match = records.find((record) => record.metadata.record_id === id);
      if (match && (!jozOnly || match.metadata.joz_specific)) return match;
    }
  }

  const candidates = records.filter((record) => {
    if (record.metadata.policy_record) return false;
    if (jozOnly && !record.metadata.joz_specific) return false;
    if (!jozSpecific && record.metadata.joz_specific) return false;
    return true;
  });
  const queryTokens = new Set(clean.split(/\s+/).filter((token) => token.length > 2));
  let best = null;
  let bestScore = 0;
  for (const record of candidates) {
    const haystack = normaliseQuestion([
      record.title,
      record.summary,
      record.body,
      record.metadata.topic,
      ...(record.metadata.tags || []),
    ].join(" "));
    const score = [...queryTokens].reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0) +
      (haystack.includes(clean) ? 20 : 0) +
      (record.metadata.record_type === "canonical_qa" ? 3 : 0);
    if (score > bestScore) {
      best = record;
      bestScore = score;
    }
  }
  return bestScore >= 2 ? best : null;
}

export function buildWorldModelCitationForRecord(record = {}) {
  return getWorldModelCitation(record);
}

export function getWorldModelKnowledgeManifest() {
  const validation = validateWorldModelKnowledge();
  return {
    dataset_id: WORLD_MODEL_DATASET_ID,
    runtime_dataset_id: WORLD_MODEL_RUNTIME_DATASET_ID,
    schema_version: "1.0",
    source_url: STANFORD_HAI_SOURCE_URL,
    source_title: STANFORD_HAI_SOURCE_TITLE,
    source_publisher: "Stanford HAI",
    source_date: "2026-07",
    source_pdf_filename: path.basename(pdfPath),
    source_pdf_checksum: validation.pdfChecksum,
    dataset_checksum: validation.datasetChecksum,
    source_pdf_page_count: validation.pdfPageCount,
    jsonl_record_count: validation.recordCount,
    pdf_chunk_count: PDF_CHUNK_PAGE_RANGES.length,
    generated_by: "shared/worldModelKnowledge.js",
  };
}

export function getWorldModelCitation(doc = {}) {
  const metadata = doc?.metadata || doc;
  const pages = Array.isArray(metadata.source_pages) ? metadata.source_pages : [];
  return {
    recordId: metadata.record_id || null,
    claimScope: metadata.claim_scope || null,
    sourceTitle: metadata.source_title || null,
    publisher: metadata.source_publisher || null,
    date: metadata.source_date || null,
    pages,
    uri: metadata.source_uri || null,
    label: metadata.citation_label || metadata.source_title || null,
  };
}

export function selectWorldModelPolicyRecords(documents = [], query = "") {
  const profile = getWorldModelQueryProfile(query);
  if (!profile.isWorldModel || !profile.isJozSpecific) return [];
  return documents
    .filter((doc) => doc?.metadata?.world_model_record && (doc?.metadata?.boundary_record || doc?.metadata?.policy_record))
    .sort((left, right) => Number(right?.metadata?.retrieval_priority || 0) - Number(left?.metadata?.retrieval_priority || 0));
}
