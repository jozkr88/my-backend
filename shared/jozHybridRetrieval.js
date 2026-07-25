const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

function cleanText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function isJozPgvectorEnabled(env = process.env) {
  const configured = String(env?.JOZ_PGVECTOR_ENABLED || "").trim().toLowerCase();
  if (configured) return ["1", "true", "yes", "on"].includes(configured);

  // Render is production-only and already requires the database. Keep local
  // development opt-in, but do not leave the deployed vector index dormant if
  // a blueprint sync omits this non-secret flag.
  return String(env?.RENDER || "").trim().toLowerCase() === "true";
}

export function getJozEmbeddingModel(env = process.env) {
  return cleanText(env?.JOZ_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL) || DEFAULT_EMBEDDING_MODEL;
}

export function buildPgvectorLiteral(embedding = []) {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("An embedding vector is required for pgvector retrieval");
  }

  const values = embedding.map((value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error("Embedding contains a non-finite value");
    return String(parsed);
  });

  return `[${values.join(",")}]`;
}

export async function createJozQueryEmbedding({
  client = null,
  query = "",
  model = DEFAULT_EMBEDDING_MODEL,
} = {}) {
  const input = cleanText(query);
  if (!client?.embeddings?.create || !input) return null;

  const response = await client.embeddings.create({
    model: cleanText(model) || DEFAULT_EMBEDDING_MODEL,
    input,
  });
  const embedding = response?.data?.[0]?.embedding;
  return Array.isArray(embedding) && embedding.length ? embedding : null;
}

export function chunkJozText(text = "", { maxCharacters = 2400, overlapCharacters = 250 } = {}) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
  const max = Math.max(400, Number(maxCharacters) || 2400);
  const overlap = Math.max(0, Math.min(max - 1, Number(overlapCharacters) || 250));
  if (!normalized) return [];
  if (normalized.length <= max) return [normalized];

  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    const hardEnd = Math.min(normalized.length, start + max);
    let end = hardEnd;
    if (hardEnd < normalized.length) {
      const boundary = normalized.lastIndexOf("\n\n", hardEnd);
      const sentenceBoundary = normalized.lastIndexOf(". ", hardEnd);
      const candidate = Math.max(boundary, sentenceBoundary);
      if (candidate > start + Math.floor(max * 0.55)) end = candidate + (candidate === sentenceBoundary ? 1 : 0);
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

function retrievalKey(doc = {}) {
  const metadata = doc?.metadata || {};
  return cleanText(
    metadata.slug || doc.slug || `${doc.title || ""}::${doc.category || ""}`
  ).toLowerCase();
}

function exactRankScore(rank) {
  return 1 / (Math.max(0, Number(rank) || 0) + 1);
}

function semanticSimilarity(doc = {}) {
  return Math.max(
    0,
    Math.min(
      1,
      finiteNumber(
        doc?.retrieval?.semanticSimilarity ??
          doc?.metadata?.semantic_similarity ??
          doc?.semanticSimilarity,
        0
      )
    )
  );
}

export function mergeJozRetrievalResults({
  exactDocuments = [],
  semanticDocuments = [],
  limit = 8,
} = {}) {
  const merged = new Map();

  exactDocuments.filter(Boolean).forEach((doc, index) => {
    const key = retrievalKey(doc);
    if (!key) return;
    merged.set(key, {
      ...doc,
      retrieval: {
        ...(doc.retrieval || {}),
        exactRank: index,
        exactScore: exactRankScore(index),
        method: "exact",
      },
    });
  });

  semanticDocuments.filter(Boolean).forEach((doc) => {
    const key = retrievalKey(doc);
    if (!key) return;
    const existing = merged.get(key);
    const semanticScore = semanticSimilarity(doc);
    merged.set(key, {
      ...(existing || {}),
      ...doc,
      metadata: { ...(existing?.metadata || {}), ...(doc.metadata || {}) },
      retrieval: {
        ...(existing?.retrieval || {}),
        ...(doc.retrieval || {}),
        semanticSimilarity: semanticScore,
        semanticScore,
        method: existing ? "hybrid" : "pgvector",
      },
    });
  });

  return [...merged.values()]
    .map((doc, index) => {
      const exactScore = finiteNumber(doc?.retrieval?.exactScore, 0);
      const semanticScore = semanticSimilarity(doc);
      const hybridScore = exactScore * 0.62 + semanticScore * 0.38;
      return {
        ...doc,
        retrieval: {
          ...(doc.retrieval || {}),
          hybridScore,
          rankBeforeRerank: index,
        },
      };
    })
    .sort((left, right) => {
      const scoreDelta =
        finiteNumber(right?.retrieval?.hybridScore) - finiteNumber(left?.retrieval?.hybridScore);
      if (scoreDelta !== 0) return scoreDelta;
      return retrievalKey(left).localeCompare(retrievalKey(right));
    })
    .slice(0, Math.max(1, Number(limit) || 8));
}
