import dotenv from "dotenv";
import OpenAI from "openai";
import pg from "pg";
import {
  buildPgvectorLiteral,
  chunkJozText,
  getJozEmbeddingModel,
} from "../shared/jozHybridRetrieval.js";

dotenv.config();

const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
const apiKey = process.env.OPENAI_API_KEY || "";

if (!databaseUrl) throw new Error("Missing SUPABASE_DB_URL or DATABASE_URL");
if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === "production" || process.env.RENDER || process.env.SUPABASE_DB_URL
    ? { rejectUnauthorized: false }
    : false,
});
const client = new OpenAI({ apiKey });
const model = getJozEmbeddingModel();
const batchSize = Math.max(1, Number.parseInt(process.env.JOZ_EMBEDDING_BATCH_SIZE || "32", 10));

async function run() {
  await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS joz_document_chunks (
      id BIGSERIAL PRIMARY KEY,
      document_id BIGINT NOT NULL REFERENCES joz_documents(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      token_count INTEGER,
      embedding_model TEXT,
      embedding VECTOR(1536),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(document_id, chunk_index)
    )
  `);

  const documents = await pool.query(`
    SELECT id, title, summary, body, metadata
    FROM joz_documents
    WHERE is_runtime_active = TRUE AND visibility = 'public'
    ORDER BY id ASC
  `);

  let chunkCount = 0;
  for (const document of documents.rows || []) {
    const text = [document.title, document.summary, document.body].filter(Boolean).join("\n\n");
    const chunks = chunkJozText(text);
    if (!chunks.length) continue;

    for (let offset = 0; offset < chunks.length; offset += batchSize) {
      const batch = chunks.slice(offset, offset + batchSize);
      const response = await client.embeddings.create({ model, input: batch });
      const embeddings = response?.data || [];
      if (embeddings.length !== batch.length) {
        throw new Error(`Embedding count mismatch for document ${document.id}`);
      }

      for (let index = 0; index < batch.length; index += 1) {
        const chunkIndex = offset + index;
        await pool.query(
          `INSERT INTO joz_document_chunks (
             document_id, chunk_index, content, token_count, embedding_model, embedding, metadata
           ) VALUES ($1, $2, $3, $4, $5, $6::vector, $7::jsonb)
           ON CONFLICT (document_id, chunk_index)
           DO UPDATE SET content = EXCLUDED.content,
                         token_count = EXCLUDED.token_count,
                         embedding_model = EXCLUDED.embedding_model,
                         embedding = EXCLUDED.embedding,
                         metadata = EXCLUDED.metadata`,
          [
            document.id,
            chunkIndex,
            batch[index],
            Math.ceil(batch[index].length / 4),
            model,
            buildPgvectorLiteral(embeddings[index].embedding),
            JSON.stringify({
              document_slug: document.metadata?.slug || null,
              source_checksum: document.metadata?.source_checksum || null,
              generated_at: new Date().toISOString(),
            }),
          ]
        );
        chunkCount += 1;
      }
    }
  }

  await pool.query(`
    CREATE INDEX IF NOT EXISTS joz_document_chunks_embedding_hnsw_idx
      ON joz_document_chunks USING hnsw (embedding vector_cosine_ops)
      WHERE embedding IS NOT NULL
  `);
  console.log(JSON.stringify({ documents: documents.rows?.length || 0, chunks: chunkCount, model }, null, 2));
}
try {
  await run();
} finally {
  await pool.end().catch(() => {});
}
