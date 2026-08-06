import neo4j from "neo4j-driver";
import {
  getJozKnowledgeGraphQueryStartNodeIds,
  loadPublishedJozKnowledgeGraph,
  queryJozKnowledgeGraph,
} from "./jozKnowledgeGraph.js";

let driver = null;

function cleanText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function graphPropertyMap(value = {}) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, property]) =>
      property !== null &&
      property !== undefined &&
      ["string", "number", "boolean"].includes(typeof property)
    )
  );
}

export function isNeo4jJozKnowledgeGraphConfigured(env = process.env) {
  return Boolean(
    cleanText(env?.NEO4J_URI) &&
      cleanText(env?.NEO4J_USERNAME || env?.NEO4J_USER) &&
      cleanText(env?.NEO4J_PASSWORD)
  );
}

export function getNeo4jJozKnowledgeGraphConfig(env = process.env) {
  return {
    uri: cleanText(env?.NEO4J_URI),
    username: cleanText(env?.NEO4J_USERNAME || env?.NEO4J_USER || "neo4j"),
    password: cleanText(env?.NEO4J_PASSWORD),
    database: cleanText(env?.NEO4J_DATABASE || "neo4j") || "neo4j",
  };
}

export function getNeo4jJozKnowledgeGraphDriver(env = process.env) {
  if (!isNeo4jJozKnowledgeGraphConfigured(env)) return null;
  if (driver) return driver;
  const config = getNeo4jJozKnowledgeGraphConfig(env);
  driver = neo4j.driver(
    config.uri,
    neo4j.auth.basic(config.username, config.password),
    { maxConnectionPoolSize: 10 }
  );
  return driver;
}

export async function closeNeo4jJozKnowledgeGraph() {
  if (!driver) return;
  const currentDriver = driver;
  driver = null;
  await currentDriver.close();
}

export async function ensureNeo4jJozKnowledgeGraphSchema({ env = process.env } = {}) {
  const currentDriver = getNeo4jJozKnowledgeGraphDriver(env);
  if (!currentDriver) return { configured: false, created: false };
  const config = getNeo4jJozKnowledgeGraphConfig(env);
  const session = currentDriver.session({ database: config.database });
  try {
    await session.executeWrite((transaction) => transaction.run(
      "CREATE CONSTRAINT joz_kg_node_id IF NOT EXISTS FOR (node:JozEntity) REQUIRE node.id IS UNIQUE"
    ));
    await session.executeWrite((transaction) => transaction.run(
      "CREATE INDEX joz_kg_node_type IF NOT EXISTS FOR (node:JozEntity) ON (node.type)"
    ));
    return { configured: true, created: true, database: config.database };
  } finally {
    await session.close();
  }
}

export async function importJozKnowledgeGraphToNeo4j({ graph, env = process.env, batchSize = 500 } = {}) {
  const currentDriver = getNeo4jJozKnowledgeGraphDriver(env);
  if (!currentDriver) return { configured: false, importedNodes: 0, importedEdges: 0 };
  const config = getNeo4jJozKnowledgeGraphConfig(env);
  const session = currentDriver.session({ database: config.database });
  const nodes = (graph?.nodes || []).map((node) => ({
    id: node.id,
    type: node.type,
    label: node.label || node.id,
    properties: graphPropertyMap({
      category: node.category,
      slug: node.slug,
      summary: node.summary,
      description: node.description,
      verification: node.verification,
      impactScore: node.impactScore,
      company: node.company,
      sourceFilename: node.sourceFilename,
      sourceMetaFilename: node.sourceMetaFilename,
      sourceUri: node.sourceUri,
      sourcePath: node.sourcePath,
      sourceChecksum: node.sourceChecksum,
      evidenceTier: node.evidenceTier,
      claimType: node.claimType,
      relation: node.relation,
      claimStatus: node.claimStatus,
      confidence: node.confidence,
      datasetId: node.datasetId,
      modelVersion: node.modelVersion,
      sourceSlug: node.sourceSlug,
    }),
  }));
  const edges = (graph?.edges || []).map((edge) => ({
    id: edge.id,
    from: edge.from,
    to: edge.to,
    type: edge.type,
    properties: graphPropertyMap({
      verification: edge.verification,
      impactScore: edge.impactScore,
      sourceSlug: edge.sourceSlug,
      sourceSlugs: Array.isArray(edge.sourceSlugs) ? edge.sourceSlugs.join(",") : null,
      claimStatus: edge.claimStatus,
      relation: edge.relation,
      confidence: edge.confidence,
      datasetId: edge.datasetId,
      modelVersion: edge.modelVersion,
    }),
  }));

  try {
    await ensureNeo4jJozKnowledgeGraphSchema({ env });
    for (let offset = 0; offset < nodes.length; offset += batchSize) {
      await session.executeWrite((transaction) => transaction.run(
        `UNWIND $nodes AS node
         MERGE (entity:JozEntity {id: node.id})
         SET entity.type = node.type,
             entity.label = node.label,
             entity += node.properties`,
        { nodes: nodes.slice(offset, offset + batchSize) }
      ));
    }
    for (let offset = 0; offset < edges.length; offset += batchSize) {
      await session.executeWrite((transaction) => transaction.run(
        `UNWIND $edges AS edge
         MATCH (source:JozEntity {id: edge.from})
         MATCH (target:JozEntity {id: edge.to})
         MERGE (source)-[relationship:JOZ_REL {id: edge.id}]->(target)
         SET relationship.type = edge.type,
             relationship += edge.properties`,
        { edges: edges.slice(offset, offset + batchSize) }
      ));
    }
    return {
      configured: true,
      importedNodes: nodes.length,
      importedEdges: edges.length,
      database: config.database,
    };
  } finally {
    await session.close();
  }
}

export async function upsertJozCausalDatasetMetadataToNeo4j({ dataset = {}, env = process.env } = {}) {
  if (!dataset?.dataset_id || !dataset?.model_version) {
    return { configured: false, importedNodes: 0, importedEdges: 0, reason: "dataset_identity_required" };
  }
  const nodes = [
    {
      id: `causal_dataset:${dataset.dataset_id}`,
      type: "causal_dataset",
      label: dataset.dataset_id,
      datasetId: dataset.dataset_id,
      modelVersion: dataset.model_version,
      tenantId: dataset.tenant_id || "public",
      rowCount: Array.isArray(dataset.data) ? dataset.data.length : 0,
      checksum: dataset.checksum || null,
    },
    {
      id: `causal_model_version:${dataset.dataset_id}:${dataset.model_version}`,
      type: "causal_model_version",
      label: dataset.model_version,
      datasetId: dataset.dataset_id,
      modelVersion: dataset.model_version,
    },
    ...(dataset.nodes || []).map((node) => ({
      id: `causal_variable:${dataset.dataset_id}:${dataset.model_version}:${node.id}`,
      type: "causal_variable",
      label: node.label || node.id,
      datasetId: dataset.dataset_id,
      modelVersion: dataset.model_version,
    })),
  ];
  const edges = [
    {
      id: `causal_dataset_uses_version:${dataset.dataset_id}:${dataset.model_version}`,
      from: `causal_dataset:${dataset.dataset_id}`,
      to: `causal_model_version:${dataset.dataset_id}:${dataset.model_version}`,
      type: "uses_model_version",
      datasetId: dataset.dataset_id,
      modelVersion: dataset.model_version,
    },
    ...(dataset.nodes || []).map((node) => ({
      id: `causal_dataset_contains_variable:${dataset.dataset_id}:${dataset.model_version}:${node.id}`,
      from: `causal_model_version:${dataset.dataset_id}:${dataset.model_version}`,
      to: `causal_variable:${dataset.dataset_id}:${dataset.model_version}:${node.id}`,
      type: "contains_variable",
      datasetId: dataset.dataset_id,
      modelVersion: dataset.model_version,
    })),
    ...(dataset.edges || []).map((edge) => ({
      id: `causal_edge:${dataset.dataset_id}:${dataset.model_version}:${edge.source}:${edge.target}`,
      from: `causal_variable:${dataset.dataset_id}:${dataset.model_version}:${edge.source}`,
      to: `causal_variable:${dataset.dataset_id}:${dataset.model_version}:${edge.target}`,
      type: edge.type || "CAUSES",
      datasetId: dataset.dataset_id,
      modelVersion: dataset.model_version,
    })),
  ];
  return importJozKnowledgeGraphToNeo4j({ graph: { nodes, edges }, env });
}

export async function queryNeo4jJozKnowledgeGraph({ query = "", limit = 8, env = process.env } = {}) {
  const currentDriver = getNeo4jJozKnowledgeGraphDriver(env);
  if (!currentDriver) return null;
  const config = getNeo4jJozKnowledgeGraphConfig(env);
  const graph = loadPublishedJozKnowledgeGraph();
  const startIds = getJozKnowledgeGraphQueryStartNodeIds(query, graph);
  if (!startIds.length) {
    return {
      backend: "neo4j",
      mode: "shadow",
      matchedNodeIds: [],
      paths: [],
      documents: [],
      documentSlugs: [],
      nodeCount: null,
      edgeCount: null,
    };
  }

  const session = currentDriver.session({ database: config.database });
  try {
    const result = await session.executeRead((transaction) => transaction.run(
      `MATCH (start:JozEntity)
       WHERE start.id IN $startIds
       MATCH path = (start)-[:JOZ_REL*1..2]-(document:JozEntity {type: 'document'})
       WITH document, path,
            [relationship IN relationships(path) | relationship.type] AS edgeTypes,
            length(path) AS distance
       RETURN document.id AS id,
              document.slug AS slug,
              document.label AS title,
              document.sourcePath AS sourcePath,
              edgeTypes,
              distance
       ORDER BY distance ASC, document.id ASC
       LIMIT $limit`,
      { startIds, limit: neo4j.int(Math.max(1, Number(limit) || 8)) }
    ));

    const candidates = new Map();
    for (const record of result.records) {
      const slug = record.get("slug") || record.get("id");
      if (!slug || candidates.has(slug)) continue;
      const distance = asNumber(record.get("distance"), 0);
      const edgeTypes = record.get("edgeTypes") || [];
      candidates.set(slug, {
        slug,
        title: record.get("title") || slug,
        sourcePath: record.get("sourcePath") || null,
        score: Math.max(0, 20 - distance * 4),
        path: ["neo4j", ...edgeTypes],
        edgeTypes,
      });
    }

    const documents = [...candidates.values()].slice(0, Math.max(1, Number(limit) || 8));
    return {
      backend: "neo4j",
      mode: "shadow",
      matchedNodeIds: startIds,
      paths: documents.map((document) => ({
        start: startIds[0],
        document: document.slug,
        path: document.path,
        edgeTypes: document.edgeTypes,
      })),
      documents,
      documentSlugs: documents.map((document) => document.slug),
      nodeCount: null,
      edgeCount: null,
    };
  } finally {
    await session.close();
  }
}

export async function queryJozKnowledgeGraphRuntime({ query = "", limit = 8, env = process.env } = {}) {
  const artifact = loadPublishedJozKnowledgeGraph();
  if (!isNeo4jJozKnowledgeGraphConfigured(env)) {
    return { backend: "artifact", ...queryJozKnowledgeGraph({ graph: artifact, query, limit }) };
  }

  try {
    const neo4jResult = await queryNeo4jJozKnowledgeGraph({ query, limit, env });
    if (neo4jResult) return neo4jResult;
  } catch (error) {
    const fallback = queryJozKnowledgeGraph({ graph: artifact, query, limit });
    return {
      backend: "artifact_fallback",
      fallbackReason: String(error?.code || error?.message || "neo4j_query_failed").slice(0, 160),
      ...fallback,
    };
  }

  return { backend: "artifact", ...queryJozKnowledgeGraph({ graph: artifact, query, limit }) };
}
