import { loadPublishedJozKnowledgeGraph } from "./jozKnowledgeGraph.js";

const TOOL_NAMES = [
  "get_causal_neighbourhood",
  "explain_causal_path",
  "inspect_causal_claim",
  "estimate_causal_effect",
  "run_counterfactual",
  "refute_causal_structure",
];

const DEFAULT_MODEL_VERSION = "latest_published";
const STATUS_STRENGTH = {
  SUPPORTED_CAUSE: "supported",
  CONTEXT_DEPENDENT_CAUSE: "contextual",
  CANDIDATE_CAUSE: "uncertain",
  DISCOVERED_ASSOCIATION: "association_only",
  HYPOTHESIZED_CAUSE: "hypothesis",
  REFUTED: "refuted",
  DEPRECATED: "deprecated",
  FRAMEWORK_SUPPORTED: "framework",
};

export const JOZ_CAUSAL_TOOL_DEFINITIONS = Object.freeze([
  {
    name: "get_causal_neighbourhood",
    description: "Return version-scoped causes, effects, relationships, evidence strength, and warnings for a causal variable.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["model_id", "model_version", "variable_id", "direction", "max_depth"],
      properties: {
        model_id: { type: "string", minLength: 1, maxLength: 160 },
        model_version: { type: "string", minLength: 1, maxLength: 160 },
        variable_id: { type: "string", minLength: 1, maxLength: 240 },
        direction: { type: "string", enum: ["causes", "effects", "both"] },
        max_depth: { type: "integer", minimum: 1, maximum: 4 },
      },
    },
  },
  {
    name: "explain_causal_path",
    description: "Explain direct and indirect causal paths between two variables with status, mediators, evidence, and warnings.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["model_id", "model_version", "source_variable_id", "target_variable_id", "max_paths", "max_depth"],
      properties: {
        model_id: { type: "string", minLength: 1, maxLength: 160 },
        model_version: { type: "string", minLength: 1, maxLength: 160 },
        source_variable_id: { type: "string", minLength: 1, maxLength: 240 },
        target_variable_id: { type: "string", minLength: 1, maxLength: 240 },
        max_paths: { type: "integer", minimum: 1, maximum: 5 },
        max_depth: { type: "integer", minimum: 1, maximum: 6 },
      },
    },
  },
  {
    name: "inspect_causal_claim",
    description: "Inspect the status, evidence, assumptions, dataset, model version, and limitations for one causal claim.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["relationship_id"],
      properties: {
        relationship_id: { type: "string", minLength: 1, maxLength: 320 },
      },
    },
  },
  {
    name: "estimate_causal_effect",
    description: "Estimate a model-based average treatment effect between explicit treatment and control values using a versioned causal dataset.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["model_id", "model_version", "treatment_variable_id", "outcome_variable_id", "treatment_value", "control_value", "samples"],
      properties: {
        model_id: { type: "string", minLength: 1, maxLength: 160 },
        model_version: { type: "string", minLength: 1, maxLength: 160 },
        treatment_variable_id: { type: "string", minLength: 1, maxLength: 240 },
        outcome_variable_id: { type: "string", minLength: 1, maxLength: 240 },
        treatment_value: { type: "number" },
        control_value: { type: "number" },
        samples: { type: "integer", minimum: 100, maximum: 10000 },
      },
    },
  },
  {
    name: "run_counterfactual",
    description: "Estimate an individual-level counterfactual outcome under an explicit intervention using a factual observation and a versioned causal dataset.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["model_id", "model_version", "intervention_variable_id", "intervention_value", "target_variable_id"],
      properties: {
        model_id: { type: "string", minLength: 1, maxLength: 160 },
        model_version: { type: "string", minLength: 1, maxLength: 160 },
        intervention_variable_id: { type: "string", minLength: 1, maxLength: 240 },
        intervention_value: { type: "number" },
        target_variable_id: { type: "string", minLength: 1, maxLength: 240 },
      },
    },
  },
  {
    name: "refute_causal_structure",
    description: "Test whether a versioned causal DAG is rejected by data-based independence and local Markov robustness checks.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["model_id", "model_version", "significance_level"],
      properties: {
        model_id: { type: "string", minLength: 1, maxLength: 160 },
        model_version: { type: "string", minLength: 1, maxLength: 160 },
        significance_level: { type: "number", exclusiveMinimum: 0.001, exclusiveMaximum: 0.5 },
      },
    },
  },
]);

class CausalToolValidationError extends Error {
  constructor(message, code = "INVALID_TOOL_ARGUMENTS") {
    super(message);
    this.name = "CausalToolValidationError";
    this.code = code;
  }
}

function cleanText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slug(value = "") {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function graphMaps(graph) {
  return {
    nodes: new Map(asArray(graph?.nodes).map((node) => [node.id, node])),
    edges: asArray(graph?.edges),
  };
}

function normalizeVersion(value) {
  return cleanText(value) || DEFAULT_MODEL_VERSION;
}

function validateString(args, key, { required = true, max = 320 } = {}) {
  const value = cleanText(args?.[key]);
  if (!value && required) throw new CausalToolValidationError(`Missing ${key}.`);
  if (value.length > max) throw new CausalToolValidationError(`${key} exceeds ${max} characters.`);
  return value;
}

function validateInteger(args, key, { minimum, maximum, fallback } = {}) {
  const value = args?.[key] === undefined ? fallback : Number(args[key]);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new CausalToolValidationError(`${key} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function validateNumber(args, key) {
  const value = Number(args?.[key]);
  if (!Number.isFinite(value)) throw new CausalToolValidationError(`${key} must be a finite number.`);
  return value;
}

function validateArguments(toolName, args = {}) {
  if (!TOOL_NAMES.includes(toolName)) {
    throw new CausalToolValidationError(`Unknown causal tool: ${toolName}.`, "UNKNOWN_CAUSAL_TOOL");
  }
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new CausalToolValidationError("Tool arguments must be an object.");
  }
  const allowedKeys = new Set(
    JOZ_CAUSAL_TOOL_DEFINITIONS.find((tool) => tool.name === toolName).parameters.required
      .concat(Object.keys(JOZ_CAUSAL_TOOL_DEFINITIONS.find((tool) => tool.name === toolName).parameters.properties))
  );
  for (const key of Object.keys(args)) {
    if (!allowedKeys.has(key)) throw new CausalToolValidationError(`Unexpected tool argument: ${key}.`);
  }

  if (toolName === "get_causal_neighbourhood") {
    const direction = validateString(args, "direction", { max: 16 });
    if (!["causes", "effects", "both"].includes(direction)) {
      throw new CausalToolValidationError("direction must be causes, effects, or both.");
    }
    return {
      model_id: validateString(args, "model_id", { max: 160 }),
      model_version: validateString(args, "model_version", { max: 160 }),
      variable_id: validateString(args, "variable_id", { max: 240 }),
      direction,
      max_depth: validateInteger(args, "max_depth", { minimum: 1, maximum: 4, fallback: 2 }),
    };
  }

  if (toolName === "explain_causal_path") {
    return {
      model_id: validateString(args, "model_id", { max: 160 }),
      model_version: validateString(args, "model_version", { max: 160 }),
      source_variable_id: validateString(args, "source_variable_id", { max: 240 }),
      target_variable_id: validateString(args, "target_variable_id", { max: 240 }),
      max_paths: validateInteger(args, "max_paths", { minimum: 1, maximum: 5, fallback: 5 }),
      max_depth: validateInteger(args, "max_depth", { minimum: 1, maximum: 6, fallback: 6 }),
    };
  }

  if (toolName === "estimate_causal_effect") {
    return {
      model_id: validateString(args, "model_id", { max: 160 }),
      model_version: validateString(args, "model_version", { max: 160 }),
      treatment_variable_id: validateString(args, "treatment_variable_id", { max: 240 }),
      outcome_variable_id: validateString(args, "outcome_variable_id", { max: 240 }),
      treatment_value: validateNumber(args, "treatment_value"),
      control_value: validateNumber(args, "control_value"),
      samples: validateInteger(args, "samples", { minimum: 100, maximum: 10000, fallback: 1000 }),
    };
  }

  if (toolName === "run_counterfactual") {
    return {
      model_id: validateString(args, "model_id", { max: 160 }),
      model_version: validateString(args, "model_version", { max: 160 }),
      intervention_variable_id: validateString(args, "intervention_variable_id", { max: 240 }),
      intervention_value: validateNumber(args, "intervention_value"),
      target_variable_id: validateString(args, "target_variable_id", { max: 240 }),
    };
  }

  if (toolName === "refute_causal_structure") {
    const significanceLevel = validateNumber(args, "significance_level");
    if (significanceLevel <= 0.001 || significanceLevel >= 0.5) {
      throw new CausalToolValidationError("significance_level must be greater than 0.001 and less than 0.5.");
    }
    return {
      model_id: validateString(args, "model_id", { max: 160 }),
      model_version: validateString(args, "model_version", { max: 160 }),
      significance_level: significanceLevel,
    };
  }

  return {
    relationship_id: validateString(args, "relationship_id", { max: 320 }),
  };
}

function resolveVariable(variableId, nodes) {
  const requested = cleanText(variableId);
  const requestedSlug = slug(requested);
  return [...nodes.values()].find((node) => (
    node.type === "causal_variable" && (
      node.id === requested ||
      node.id === `causal_variable:${requestedSlug}` ||
      slug(node.label) === requestedSlug
    )
  )) || null;
}

function claimRelationships(graph, requestedModelId = "", requestedVersion = DEFAULT_MODEL_VERSION) {
  const { nodes, edges } = graphMaps(graph);
  const byFrom = new Map();
  for (const edge of edges) {
    const list = byFrom.get(edge.from) || [];
    list.push(edge);
    byFrom.set(edge.from, list);
  }

  return [...nodes.values()]
    .filter((node) => node.type === "causal_claim")
    .map((claim) => {
      const claimEdges = byFrom.get(claim.id) || [];
      const subjectEdge = claimEdges.find((edge) => edge.type === "claims_about");
      const objectEdge = claimEdges.find((edge) => edge.type === "predicts");
      const subject = nodes.get(subjectEdge?.to);
      const object = nodes.get(objectEdge?.to);
      const modelMatches = !requestedModelId || claim.datasetId === requestedModelId;
      const versionMatches = requestedVersion === DEFAULT_MODEL_VERSION || claim.modelVersion === requestedVersion;
      if (!subject || !object || !modelMatches || !versionMatches) return null;
      return {
        id: claim.id,
        label: claim.label,
        claim,
        subject,
        object,
        status: cleanText(claim.claimStatus || "HYPOTHESIZED_CAUSE") || "HYPOTHESIZED_CAUSE",
        relation: cleanText(claim.relation || "associated_with") || "associated_with",
        evidenceCount: claimEdges.filter((edge) => edge.type === "supported_by").length,
        assumptionCount: claimEdges.filter((edge) => edge.type === "requires_assumption").length,
        modelVersion: claim.modelVersion || null,
        datasetId: claim.datasetId || null,
      };
    })
    .filter(Boolean);
}

function relationshipPayload(relationship) {
  const status = relationship.status;
  return {
    id: relationship.id,
    source: relationship.subject.id,
    target: relationship.object.id,
    source_label: relationship.subject.label,
    target_label: relationship.object.label,
    relation: relationship.relation,
    status,
    evidence_strength: STATUS_STRENGTH[status] || "uncertain",
    confidence: relationship.claim.confidence ?? null,
    evidence_count: relationship.evidenceCount,
    assumption_count: relationship.assumptionCount,
    dataset_id: relationship.datasetId,
    model_version: relationship.modelVersion,
  };
}

function modelWarnings(relationships, variable = null) {
  const warnings = [];
  if (!relationships.length) warnings.push("No matching version-scoped causal relationships were found.");
  if (relationships.some((relationship) => relationship.status === "DISCOVERED_ASSOCIATION")) {
    warnings.push("Some relationships are associations only; discovery does not establish causality.");
  }
  if (relationships.some((relationship) => relationship.status === "REFUTED")) {
    warnings.push("A refuted relationship is present and must not be presented as supported.");
  }
  if (variable && !variable.observability) warnings.push("Observability is not recorded for this variable.");
  return warnings;
}

function resolvePublishedVersion(relationships, requestedVersion) {
  if (requestedVersion !== DEFAULT_MODEL_VERSION) return requestedVersion;
  return relationships.find((relationship) => relationship.modelVersion)?.modelVersion || null;
}

function getCausalNeighbourhood(args, graph) {
  const { nodes } = graphMaps(graph);
  const variable = resolveVariable(args.variable_id, nodes);
  if (!variable) {
    return {
      tool: "get_causal_neighbourhood",
      status: "VARIABLE_NOT_FOUND",
      variable: null,
      nodes: [],
      relationships: [],
      paths: [],
      model_version: args.model_version,
      warnings: [`Variable not found: ${args.variable_id}`],
    };
  }

  const all = claimRelationships(graph, args.model_id, normalizeVersion(args.model_version));
  const direct = all.filter((relationship) => (
    (args.direction === "causes" || args.direction === "both") && relationship.subject.id === variable.id ||
    (args.direction === "effects" || args.direction === "both") && relationship.object.id === variable.id
  ));
  const relationshipNodes = new Map([[variable.id, variable]]);
  for (const relationship of direct) {
    relationshipNodes.set(relationship.subject.id, relationship.subject);
    relationshipNodes.set(relationship.object.id, relationship.object);
  }
  const relationships = direct.map(relationshipPayload);
  return {
    tool: "get_causal_neighbourhood",
    status: "ok",
    variable: { id: variable.id, label: variable.label },
    nodes: [...relationshipNodes.values()].map((node) => ({
      id: node.id,
      label: node.label,
      type: "variable",
      observability: node.observability || "unknown",
      actionability: node.actionability || "unknown",
    })),
    relationships,
    paths: relationships.map((relationship) => [relationship.source, relationship.target]),
    model_version: resolvePublishedVersion(all, args.model_version),
    warnings: modelWarnings(direct, variable),
  };
}

function explainCausalPath(args, graph) {
  const { nodes } = graphMaps(graph);
  const source = resolveVariable(args.source_variable_id, nodes);
  const target = resolveVariable(args.target_variable_id, nodes);
  if (!source || !target) {
    return {
      tool: "explain_causal_path",
      status: "VARIABLE_NOT_FOUND",
      paths: [],
      model_version: args.model_version,
      warnings: [source ? `Variable not found: ${args.target_variable_id}` : `Variable not found: ${args.source_variable_id}`],
    };
  }
  const relationships = claimRelationships(graph, args.model_id, normalizeVersion(args.model_version));
  const outgoing = new Map();
  for (const relationship of relationships) {
    const list = outgoing.get(relationship.subject.id) || [];
    list.push(relationship);
    outgoing.set(relationship.subject.id, list);
  }
  const paths = [];
  const visit = (currentId, path, seen) => {
    if (paths.length >= args.max_paths || path.length >= args.max_depth) return;
    for (const relationship of outgoing.get(currentId) || []) {
      if (seen.has(relationship.object.id)) continue;
      const nextPath = [...path, relationship];
      if (relationship.object.id === target.id) {
        const payload = nextPath.map(relationshipPayload);
        paths.push({
          type: payload.length === 1 ? "direct" : "indirect",
          relationships: payload,
          mediators: payload.slice(0, -1).map((item) => ({ id: item.target, label: item.target_label })),
          potential_confounders: [],
          unsupported_edges: payload.filter((item) => ["association_only", "hypothesis", "uncertain"].includes(item.evidence_strength)),
          refuted_edges: payload.filter((item) => item.status === "REFUTED"),
          evidence_strength: payload.every((item) => item.evidence_strength === "supported") ? "supported" : "uncertain",
        });
        continue;
      }
      visit(relationship.object.id, nextPath, new Set([...seen, relationship.object.id]));
    }
  };
  visit(source.id, [], new Set([source.id]));
  const warnings = [];
  if (!paths.length) warnings.push("No directed causal path was found in the selected model version.");
  if (paths.some((path) => path.potential_confounders.length === 0)) {
    warnings.push("Potential confounders are not encoded in the current graph projection.");
  }
  return {
    tool: "explain_causal_path",
    status: paths.length ? "ok" : "PATH_NOT_FOUND",
    source: { id: source.id, label: source.label },
    target: { id: target.id, label: target.label },
    paths,
    model_version: resolvePublishedVersion(relationships, args.model_version),
    warnings,
  };
}

function inspectCausalClaim(args, graph) {
  const { nodes, edges } = graphMaps(graph);
  const requested = cleanText(args.relationship_id);
  const requestedSlug = slug(requested);
  const claim = [...nodes.values()].find((node) => (
    node.type === "causal_claim" && (
      node.id === requested ||
      node.id.endsWith(`:${requested}`) ||
      slug(node.label) === requestedSlug
    )
  ));
  if (!claim) {
    return {
      tool: "inspect_causal_claim",
      status: "RELATIONSHIP_NOT_FOUND",
      relationship_id: requested,
      warnings: [`Causal claim not found: ${requested}`],
    };
  }
  const relatedEdges = edges.filter((edge) => edge.from === claim.id);
  const relatedNode = (type) => relatedEdges
    .filter((edge) => edge.type === type)
    .map((edge) => nodes.get(edge.to))
    .filter(Boolean)
    .map((node) => ({ id: node.id, label: node.label, type: node.type }));
  const status = cleanText(claim.claimStatus || "HYPOTHESIZED_CAUSE") || "HYPOTHESIZED_CAUSE";
  return {
    tool: "inspect_causal_claim",
    status: "ok",
    relationship_id: claim.id,
    relationship: {
      id: claim.id,
      label: claim.label,
      relation: claim.relation || "associated_with",
      status,
      evidence_strength: STATUS_STRENGTH[status] || "uncertain",
      confidence: claim.confidence ?? null,
    },
    evidence: relatedNode("supported_by"),
    assumptions: relatedNode("requires_assumption"),
    refutation_history: [],
    dataset_versions: relatedNode("evaluated_with"),
    model_versions: relatedNode("uses_model_version"),
    limitations: [
      "The current graph stores framework claims and provenance, not a completed empirical refutation history for this relationship.",
    ],
    warnings: status === "FRAMEWORK_SUPPORTED"
      ? ["This is framework-supported architecture knowledge, not evidence of a production causal effect."]
      : [],
  };
}

export function getJozCausalToolDefinitions() {
  return JOZ_CAUSAL_TOOL_DEFINITIONS;
}

export function validateJozCausalToolArguments(toolName, args = {}) {
  return validateArguments(toolName, args);
}

export function executeJozCausalTool({ toolName, args = {}, graph = loadPublishedJozKnowledgeGraph() } = {}) {
  const validated = validateArguments(toolName, args);
  if (toolName === "get_causal_neighbourhood") return getCausalNeighbourhood(validated, graph);
  if (toolName === "explain_causal_path") return explainCausalPath(validated, graph);
  if (toolName === "estimate_causal_effect") {
    return {
      tool: "estimate_causal_effect",
      status: "data_required",
      model_id: validated.model_id,
      model_version: validated.model_version,
      treatment_variable_id: validated.treatment_variable_id,
      outcome_variable_id: validated.outcome_variable_id,
      warnings: ["A versioned DAG and observed tabular dataset must be supplied in the authorized causal runtime context."],
    };
  }
  if (toolName === "run_counterfactual") {
    return {
      tool: "run_counterfactual",
      status: "data_required",
      model_id: validated.model_id,
      model_version: validated.model_version,
      target_variable_id: validated.target_variable_id,
      warnings: ["A versioned DAG, observed tabular dataset, and factual row must be supplied in the authorized causal runtime context."],
    };
  }
  if (toolName === "refute_causal_structure") {
    return {
      tool: "refute_causal_structure",
      status: "data_required",
      model_id: validated.model_id,
      model_version: validated.model_version,
      warnings: ["A versioned DAG and observed tabular dataset must be supplied in the authorized causal runtime context."],
    };
  }
  return inspectCausalClaim(validated, graph);
}
