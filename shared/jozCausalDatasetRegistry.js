import { createHash } from "node:crypto";

const MAX_NODES = 200;
const MAX_EDGES = 1000;
const MAX_ROWS = 100000;
const MIN_ROWS = 20;

function cleanText(value = "", max = 240) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function checksum(value) {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function hasCycle(nodeIds, edges) {
  const indegree = new Map(nodeIds.map((id) => [id, 0]));
  const outgoing = new Map(nodeIds.map((id) => [id, []]));
  for (const edge of edges) {
    outgoing.get(edge.source).push(edge.target);
    indegree.set(edge.target, indegree.get(edge.target) + 1);
  }
  const queue = nodeIds.filter((id) => indegree.get(id) === 0);
  let visited = 0;
  while (queue.length) {
    const current = queue.shift();
    visited += 1;
    for (const target of outgoing.get(current)) {
      indegree.set(target, indegree.get(target) - 1);
      if (indegree.get(target) === 0) queue.push(target);
    }
  }
  return visited !== nodeIds.length;
}

export function validateJozCausalDataset(dataset = {}) {
  const metadata = dataset?.metadata && typeof dataset.metadata === "object" ? dataset.metadata : {};
  const datasetId = cleanText(metadata.dataset_id || dataset.dataset_id, 160);
  const modelVersion = cleanText(
    metadata.model_version || metadata.causal_model_version || dataset.model_version || dataset.causal_model_version,
    160
  );
  const tenantId = cleanText(metadata.tenant_id || dataset.tenant_id || "public", 160) || "public";
  const nodes = Array.isArray(dataset?.nodes) ? dataset.nodes : [];
  const edges = Array.isArray(dataset?.edges) ? dataset.edges : [];
  const data = Array.isArray(dataset?.data) ? dataset.data : [];
  const errors = [];

  if (!datasetId) errors.push("dataset_id_required");
  if (!modelVersion) errors.push("model_version_required");
  if (nodes.length < 2 || nodes.length > MAX_NODES) errors.push("invalid_node_count");
  if (edges.length < 1 || edges.length > MAX_EDGES) errors.push("invalid_edge_count");
  if (data.length < MIN_ROWS || data.length > MAX_ROWS) errors.push("invalid_row_count");

  const nodeIds = nodes.map((node) => cleanText(node?.id, 240));
  if (nodeIds.some((id) => !id) || new Set(nodeIds).size !== nodeIds.length) errors.push("node_ids_must_be_unique");
  const nodeSet = new Set(nodeIds);
  const normalizedEdges = edges.map((edge) => ({
    source: cleanText(edge?.source, 240),
    target: cleanText(edge?.target, 240),
    type: cleanText(edge?.type || "CAUSES", 100) || "CAUSES",
  }));
  if (normalizedEdges.some((edge) => !nodeSet.has(edge.source) || !nodeSet.has(edge.target))) {
    errors.push("edge_references_unknown_node");
  }
  if (normalizedEdges.some((edge) => edge.source === edge.target)) errors.push("self_loop_not_allowed");
  if (!errors.includes("edge_references_unknown_node") && hasCycle(nodeIds, normalizedEdges)) errors.push("graph_must_be_acyclic");

  for (const [index, row] of data.entries()) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      errors.push(`row_${index}_must_be_an_object`);
      break;
    }
    if (nodeIds.some((id) => !isFiniteNumber(row[id]))) {
      errors.push(`row_${index}_contains_missing_or_non_numeric_values`);
      break;
    }
  }

  const factual = dataset?.factual;
  if (factual !== undefined) {
    if (!factual || typeof factual !== "object" || Array.isArray(factual) || nodeIds.some((id) => !isFiniteNumber(factual[id]))) {
      errors.push("factual_row_must_contain_numeric_values_for_every_node");
    }
  }

  const normalized = {
    schema_version: cleanText(metadata.schema_version || dataset.schema_version || "joz.causal-dataset.v1", 80),
    dataset_id: datasetId,
    model_version: modelVersion,
    tenant_id: tenantId,
    nodes,
    edges: normalizedEdges,
    data,
    ...(factual === undefined ? {} : { factual }),
  };
  return {
    ok: errors.length === 0,
    errors,
    dataset: errors.length === 0 ? { ...normalized, checksum: checksum(normalized) } : null,
  };
}

export function resolveJozCausalDataset({
  context = {},
  requestedModelId = "",
  requestedModelVersion = "",
  principal = {},
} = {}) {
  const raw = context?.causalData || context?.causal_data || null;
  if (!raw) return { ok: false, code: "CAUSAL_DATA_REQUIRED", errors: ["causal_data_required"], dataset: null };
  const validated = validateJozCausalDataset(raw);
  if (!validated.ok) return { ok: false, code: "CAUSAL_DATA_INVALID", ...validated };

  const dataset = validated.dataset;
  if (cleanText(requestedModelId, 160) && dataset.dataset_id !== cleanText(requestedModelId, 160)) {
    return { ok: false, code: "CAUSAL_DATASET_ID_MISMATCH", errors: ["dataset_id_mismatch"], dataset: null };
  }
  if (
    cleanText(requestedModelVersion, 160) &&
    cleanText(requestedModelVersion, 160) !== "latest_published" &&
    dataset.model_version !== cleanText(requestedModelVersion, 160)
  ) {
    return { ok: false, code: "CAUSAL_MODEL_VERSION_MISMATCH", errors: ["model_version_mismatch"], dataset: null };
  }
  const principalTenant = cleanText(principal?.tenantId || "public", 160) || "public";
  if (dataset.tenant_id !== principalTenant && dataset.tenant_id !== "public") {
    return { ok: false, code: "CAUSAL_DATASET_TENANT_MISMATCH", errors: ["tenant_mismatch"], dataset: null };
  }
  return { ok: true, code: "CAUSAL_DATASET_VALID", errors: [], dataset };
}
