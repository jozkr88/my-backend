import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPgvectorLiteral,
  chunkJozText,
  createJozQueryEmbedding,
  isJozPgvectorEnabled,
  mergeJozRetrievalResults,
} from "./jozHybridRetrieval.js";

test("pgvector feature flag is opt-in and vector literals are safe", () => {
  assert.equal(isJozPgvectorEnabled({ JOZ_PGVECTOR_ENABLED: "true" }), true);
  assert.equal(isJozPgvectorEnabled({ JOZ_PGVECTOR_ENABLED: "false" }), false);
  assert.equal(isJozPgvectorEnabled({ RENDER: "true" }), true);
  assert.equal(isJozPgvectorEnabled({}), true);
  assert.equal(buildPgvectorLiteral([0.1, -2, 3]), "[0.1,-2,3]");
  assert.throws(() => buildPgvectorLiteral([1, Number.NaN]), /non-finite/);
});

test("hybrid retrieval deduplicates exact and semantic evidence", () => {
  const result = mergeJozRetrievalResults({
    exactDocuments: [
      { title: "Architecture", category: "skills", metadata: { slug: "architecture" } },
      { title: "Governance", category: "governance", metadata: { slug: "governance" } },
    ],
    semanticDocuments: [
      {
        title: "Architecture",
        category: "skills",
        summary: "Semantic match",
        metadata: { slug: "architecture" },
        retrieval: { semanticSimilarity: 0.99 },
      },
      {
        title: "Verification",
        category: "governance",
        metadata: { slug: "verification" },
        retrieval: { semanticSimilarity: 0.95 },
      },
    ],
    limit: 3,
  });

  assert.equal(result.length, 3);
  assert.equal(result.filter((doc) => doc.metadata.slug === "architecture").length, 1);
  assert.equal(result.find((doc) => doc.metadata.slug === "architecture")?.retrieval?.method, "hybrid");
  assert.ok(result.every((doc) => Number.isFinite(doc.retrieval.hybridScore)));
});

test("query embeddings use the configured embedding model and fail closed without a client", async () => {
  assert.equal(await createJozQueryEmbedding({ query: "hello" }), null);

  const calls = [];
  const embedding = await createJozQueryEmbedding({
    client: {
      embeddings: {
        async create(request) {
          calls.push(request);
          return { data: [{ embedding: [0.25, -0.5] }] };
        },
      },
    },
    query: "  hello   world ",
    model: "test-embedding",
  });

  assert.deepEqual(embedding, [0.25, -0.5]);
  assert.deepEqual(calls, [{ model: "test-embedding", input: "hello world" }]);
});

test("document chunking is deterministic and keeps bounded overlap", () => {
  const chunks = chunkJozText("A".repeat(900), { maxCharacters: 400, overlapCharacters: 40 });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 400));
  assert.ok(chunks[1].startsWith("A"));
  assert.deepEqual(chunkJozText("short text", { maxCharacters: 400 }), ["short text"]);
});
