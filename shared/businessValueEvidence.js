import crypto from "node:crypto";
import { NODE_DEFINITIONS } from "./businessValueDiagnostic.js";

export const MAX_BUSINESS_VALUE_DOCUMENT_CHARS = 200_000;

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value = "") {
  return clean(value)
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[_-]+/g, " ");
}

function hash(value = "") {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function sentenceCandidates(content = "") {
  return String(content || "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map(clean)
    .filter(Boolean);
}

function containsTerm(text, term) {
  return normalize(text).includes(normalize(term));
}

export function ingestBusinessValueDocument({
  title = "",
  content = "",
  sourceType = "company_document",
  sourceRef = null,
  companyKey = null,
} = {}) {
  const normalizedTitle = clean(title) || "Untitled company document";
  const normalizedContent = String(content || "").trim();
  if (!normalizedContent) throw new Error("Document content is required");
  if (normalizedContent.length > MAX_BUSINESS_VALUE_DOCUMENT_CHARS) {
    throw new Error(`Document exceeds ${MAX_BUSINESS_VALUE_DOCUMENT_CHARS} characters`);
  }

  const contentHash = hash(normalizedContent);
  const documentId = `bvd-${contentHash.slice(0, 24)}`;
  const document = {
    documentId,
    title: normalizedTitle.slice(0, 240),
    sourceType: clean(sourceType) || "company_document",
    sourceRef: clean(sourceRef) || documentId,
    companyKey: clean(companyKey) || null,
    contentHash,
    characterCount: normalizedContent.length,
    ingestedAt: new Date().toISOString(),
    verificationStatus: "unverified",
  };

  const sentences = sentenceCandidates(normalizedContent);
  const candidates = [];
  for (const [node, definition] of Object.entries(NODE_DEFINITIONS)) {
    for (const evidenceDefinition of definition.evidence) {
      const snippets = sentences
        .filter((sentence) => evidenceDefinition.terms.some((term) => containsTerm(sentence, term)))
        .slice(0, 3);
      if (!snippets.length) continue;
      candidates.push({
        evidenceKey: `${node}.${evidenceDefinition.id}`,
        node,
        label: evidenceDefinition.label,
        value: {
          documentId,
          title: document.title,
          snippets,
          extraction: "deterministic_term_match",
        },
        sourceType: document.sourceType,
        sourceRef: document.sourceRef,
        verificationStatus: "unverified",
        collectedAt: document.ingestedAt,
      });
    }
  }

  return { document, candidates };
}

export function dedupeBusinessValueEvidence(records = []) {
  const byKey = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const key = `${record?.evidenceKey || ""}:${record?.sourceRef || record?.value?.documentId || ""}`;
    if (!key || key === ":") continue;
    byKey.set(key, record);
  }
  return [...byKey.values()];
}
