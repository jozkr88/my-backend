import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mapJozQueryToOntology } from "./jozOntology.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GRAPH_SCHEMA = "joz.knowledge-graph.v1";
const GRAPH_FILE = "joz-knowledge-graph.generated.json";
const GRAPH_FIELDS = [
  "problems",
  "principles",
  "capabilities",
  "outcomes",
  "governance",
  "industries",
  "proofs",
];
const FIELD_TYPES = {
  problems: "problem",
  principles: "principle",
  capabilities: "capability",
  outcomes: "outcome",
  governance: "governance",
  industries: "industry",
  proofs: "proof",
};

function cleanText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slugify(value = "") {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function asList(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  if (typeof value === "string") return value.split(",").map(cleanText).filter(Boolean);
  return [];
}

function nodeId(type, value) {
  const id = slugify(value);
  return id ? `${type}:${id}` : null;
}

function envFlag(value, fallback = false) {
  const normalized = cleanText(value).toLowerCase();
  if (!normalized) return fallback;
  return ["1", "true", "yes", "on"].includes(normalized);
}

export function getJozKnowledgeGraphMode(env = process.env) {
  const configured = cleanText(env?.JOZ_KNOWLEDGE_GRAPH_MODE).toLowerCase();
  if (["disabled", "shadow", "augment"].includes(configured)) return configured;
  return envFlag(env?.JOZ_KNOWLEDGE_GRAPH_ENABLED, true) ? "shadow" : "disabled";
}

export function isJozKnowledgeGraphEnabled(env = process.env) {
  return getJozKnowledgeGraphMode(env) !== "disabled";
}

function resolveGraphPath() {
  const candidates = [
    path.join(process.cwd(), "data", "joz", "published", GRAPH_FILE),
    path.join(__dirname, "..", "..", "data", "joz", "published", GRAPH_FILE),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

let graphCache = null;

export function loadPublishedJozKnowledgeGraph() {
  if (graphCache) return graphCache;
  const graphPath = resolveGraphPath();
  if (!fs.existsSync(graphPath)) {
    graphCache = {
      schema: GRAPH_SCHEMA,
      version: 1,
      nodes: [],
      edges: [],
      source: graphPath,
      unavailable: true,
    };
    return graphCache;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(graphPath, "utf8"));
    graphCache = {
      schema: parsed?.schema || GRAPH_SCHEMA,
      version: parsed?.version || 1,
      nodes: Array.isArray(parsed?.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed?.edges) ? parsed.edges : [],
      source: graphPath,
      unavailable: false,
    };
  } catch (error) {
    graphCache = {
      schema: GRAPH_SCHEMA,
      version: 1,
      nodes: [],
      edges: [],
      source: graphPath,
      unavailable: true,
      error: String(error?.message || "graph_load_failed").slice(0, 160),
    };
  }

  return graphCache;
}

function nodeSearchText(node = {}) {
  return cleanText(
    [node.id, node.type, node.label, node.description, ...(node.aliases || [])].filter(Boolean).join(" ")
  ).toLowerCase();
}

export function getJozKnowledgeGraphQueryStartNodeIds(query = "", graph = {}) {
  const ontology = mapJozQueryToOntology(query);
  const ids = new Set();

  for (const field of GRAPH_FIELDS) {
    for (const value of ontology[field] || []) {
      const id = nodeId(FIELD_TYPES[field], value);
      if (id) ids.add(id);
    }
  }

  const cleanQuery = cleanText(query).toLowerCase();
  const queryTokens = new Set(
    cleanQuery
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 5 && !["about", "build", "does", "from", "how", "joz", "prove", "proves", "what", "with"].includes(token))
  );
  for (const node of graph.nodes || []) {
    const text = nodeSearchText(node);
    if (!text) continue;
    const label = cleanText(node.label).toLowerCase();
    const labelTokens = label.split(/[^a-z0-9]+/).filter((token) => token.length >= 5);
    if (label.length >= 4 && cleanQuery.includes(label)) ids.add(node.id);
    if (node.type !== "document" && labelTokens.some((token) => queryTokens.has(token))) ids.add(node.id);
  }

  return [...ids].filter((id) => (graph.nodes || []).some((node) => node.id === id));
}

function buildAdjacency(graph = {}) {
  const adjacency = new Map();
  for (const edge of graph.edges || []) {
    if (!edge?.from || !edge?.to) continue;
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
    adjacency.get(edge.from).push({ nodeId: edge.to, edge, direction: "outgoing" });
    adjacency.get(edge.to).push({ nodeId: edge.from, edge, direction: "incoming" });
  }
  return adjacency;
}

function graphNodeMap(graph = {}) {
  return new Map((graph.nodes || []).map((node) => [node.id, node]));
}

function graphEdgeScore(edge = {}) {
  const verification = cleanText(edge.verification || edge.verificationStatus).toLowerCase();
  const verificationScore =
    verification === "cv_supported" || verification === "verified"
      ? 20
      : verification.includes("supported")
        ? 14
        : 5;
  return verificationScore + Number(edge.impactScore || 0) / 20;
}

export function queryJozKnowledgeGraph({ graph = loadPublishedJozKnowledgeGraph(), query = "", limit = 8 } = {}) {
  if (!graph?.nodes?.length || !graph?.edges?.length || !cleanText(query)) {
    return {
      mode: "shadow",
      matchedNodeIds: [],
      paths: [],
      documentSlugs: [],
      nodeCount: graph?.nodes?.length || 0,
      edgeCount: graph?.edges?.length || 0,
    };
  }

  const starts = getJozKnowledgeGraphQueryStartNodeIds(query, graph);
  const nodes = graphNodeMap(graph);
  const adjacency = buildAdjacency(graph);
  const documentCandidates = new Map();
  const paths = [];

  for (const start of starts) {
    const queue = [{ id: start, distance: 0, path: [start], edges: [] }];
    const visited = new Set([start]);

    while (queue.length) {
      const current = queue.shift();
      const currentNode = nodes.get(current.id);
      if (currentNode?.type === "document" && currentNode.slug) {
        const score = current.edges.reduce((total, edge) => total + graphEdgeScore(edge), 0) - current.distance * 4;
        const previous = documentCandidates.get(currentNode.slug);
        if (!previous || score > previous.score) {
          documentCandidates.set(currentNode.slug, {
            slug: currentNode.slug,
            title: currentNode.label,
            score,
            path: current.path,
            edgeTypes: current.edges.map((edge) => edge.type),
          });
        }
        paths.push({
          start,
          document: currentNode.slug,
          path: current.path,
          edgeTypes: current.edges.map((edge) => edge.type),
        });
      }

      if (current.distance >= 2) continue;
      for (const next of adjacency.get(current.id) || []) {
        if (visited.has(next.nodeId)) continue;
        visited.add(next.nodeId);
        queue.push({
          id: next.nodeId,
          distance: current.distance + 1,
          path: [...current.path, next.nodeId],
          edges: [...current.edges, next.edge],
        });
      }
    }
  }

  const documents = [...documentCandidates.values()]
    .sort((left, right) => right.score - left.score || left.slug.localeCompare(right.slug))
    .slice(0, Math.max(1, Number(limit) || 8));

  return {
    mode: "shadow",
    matchedNodeIds: starts,
    paths: paths.slice(0, 20),
    documents,
    documentSlugs: documents.map((document) => document.slug),
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
  };
}

function addNode(nodes, type, value, properties = {}) {
  const id = nodeId(type, value);
  if (!id) return null;
  if (!nodes.has(id)) {
    nodes.set(id, {
      id,
      type,
      label: cleanText(properties.label || value),
      ...properties,
    });
  }
  return id;
}

function addEdge(edges, from, type, to, properties = {}) {
  if (!from || !to) return;
  const id = `${from}|${type}|${to}`;
  if (edges.has(id)) return;
  edges.set(id, { id, from, type, to, ...properties });
}

function ontologyById(ontology = {}) {
  const result = new Map();
  for (const field of GRAPH_FIELDS) {
    for (const item of ontology[field] || []) {
      if (item?.id) result.set(`${FIELD_TYPES[field]}:${item.id}`, item);
    }
  }
  return result;
}

export function buildJozKnowledgeGraph({ documents = [], ontology = {} } = {}) {
  const nodes = new Map();
  const edges = new Map();
  const ontologyItems = ontologyById(ontology);
  const personId = addNode(nodes, "person", "jozef_krupa", { label: "Jozef Krupa" });

  for (const field of GRAPH_FIELDS) {
    for (const item of ontology[field] || []) {
      addNode(nodes, FIELD_TYPES[field], item.id, {
        label: item.name || item.id,
        description: item.description || null,
      });
    }
  }

  for (const document of documents) {
    const metadata = document?.metadata || {};
    const slug = cleanText(document.slug || metadata.slug || document.title);
    if (!slug) continue;
    const documentId = addNode(nodes, "document", slug, {
      label: document.title || slug,
      slug,
      category: document.category || null,
      summary: document.summary || null,
      verification: metadata.verification_status || metadata.verification?.status || null,
      impactScore: Number(metadata.impact_score || 0),
    });

    for (const field of GRAPH_FIELDS) {
      for (const value of asList(metadata[field])) {
        const target = nodeId(FIELD_TYPES[field], value);
        if (target && ontologyItems.has(target)) addEdge(edges, documentId, "supports", target, {
          verification: metadata.verification_status || metadata.verification?.status || null,
          impactScore: Number(metadata.impact_score || 0),
          sourceSlug: slug,
        });
      }
    }

    for (const company of asList(metadata.companies)) {
      const companyId = addNode(nodes, "company", company);
      addEdge(edges, documentId, "references", companyId, { sourceSlug: slug });
    }
    for (const project of asList(metadata.projects)) {
      const projectId = addNode(nodes, "project", project);
      addEdge(edges, documentId, "references", projectId, { sourceSlug: slug });
    }
    for (const region of asList(metadata.regions)) {
      const regionId = addNode(nodes, "region", region);
      addEdge(edges, documentId, "applies_in", regionId, { sourceSlug: slug });
    }
  }

  for (const proof of ontology.proofs || []) {
    const proofId = addNode(nodes, "proof", proof.id, {
      label: proof.title || proof.id,
      description: proof.description || null,
      company: proof.company || null,
      impactScore: Number(proof.impact_score || 0),
      verification: proof.verification || null,
    });
    addEdge(edges, personId, "has_proof", proofId, {
      verification: proof.verification || null,
      impactScore: Number(proof.impact_score || 0),
    });
    if (proof.company) {
      const companyId = addNode(nodes, "company", proof.company);
      addEdge(edges, proofId, "at_company", companyId, { sourceSlugs: proof.source_slugs || [] });
    }
    for (const field of ["industries", "problems", "principles", "capabilities", "outcomes", "governance"]) {
      for (const value of asList(proof[field])) {
        const target = nodeId(FIELD_TYPES[field], value);
        if (target) addEdge(edges, proofId, `has_${FIELD_TYPES[field]}`, target, {
          verification: proof.verification || null,
          impactScore: Number(proof.impact_score || 0),
        });
      }
    }
    for (const sourceSlug of asList(proof.source_slugs)) {
      const sourceId = nodeId("document", sourceSlug);
      if (nodes.has(sourceId)) addEdge(edges, proofId, "supported_by", sourceId, {
        verification: proof.verification || null,
        impactScore: Number(proof.impact_score || 0),
      });
    }
  }

  return {
    schema: GRAPH_SCHEMA,
    version: 1,
    generatedAt: new Date().toISOString(),
    source: {
      ontology: "data/joz/published/joz-ontology.generated.json",
      documents: "data/joz/published/joz-documents.generated.json",
    },
    nodes: [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...edges.values()].sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function resetJozKnowledgeGraphCache() {
  graphCache = null;
}
