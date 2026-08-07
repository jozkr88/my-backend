import { validateJozCausalToolArguments } from "./jozCausalToolRegistry.js";
import { loadPublishedJozKnowledgeGraph } from "./jozKnowledgeGraph.js";
import { JOZ_CUSTOMER_WAIT_TIME_DATASET_ID } from "./jozCustomerWaitTimeCausalDataset.js";

const PUBLIC_TENANT_ID = "public";
const PUBLIC_DATASET_IDS = new Set(["joz-public-knowledge", JOZ_CUSTOMER_WAIT_TIME_DATASET_ID]);

function cleanText(value = "", max = 240) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function graphDatasetIds(graph = {}) {
  const ids = new Set(PUBLIC_DATASET_IDS);
  for (const node of Array.isArray(graph?.nodes) ? graph.nodes : []) {
    if (node?.type !== "causal_dataset") continue;
    const id = cleanText(node.id || "").replace(/^causal_dataset:/, "", 160);
    if (id) ids.add(id);
  }
  return ids;
}

export function buildJozCausalPrincipal({ auth = null } = {}) {
  const authenticated = Boolean(auth?.userId || auth?.sub);
  return {
    authenticated,
    userId: cleanText(auth?.userId || auth?.sub || "", 160) || null,
    tenantId: cleanText(auth?.tenantId || auth?.tenant_id || auth?.companyKey || "", 160) || PUBLIC_TENANT_ID,
    role: cleanText(auth?.role || "public", 80).toLowerCase(),
  };
}

export function authorizeJozCausalTool({
  toolName = "",
  args = {},
  mode = "disabled",
  intentKind = "informational",
  principal = buildJozCausalPrincipal(),
  graph = loadPublishedJozKnowledgeGraph(),
} = {}) {
  if (mode === "disabled") {
    return { allowed: false, code: "CAUSAL_MODE_DISABLED", reason: "Causal tools are disabled." };
  }
  if (["execute", "refuse"].includes(String(intentKind))) {
    return { allowed: false, code: "CAUSAL_INTENT_NOT_READ_ONLY", reason: "Causal tools cannot run for execution or refusal intents." };
  }

  let validated;
  try {
    validated = validateJozCausalToolArguments(toolName, args);
  } catch (error) {
    return {
      allowed: false,
      code: String(error?.code || "INVALID_TOOL_ARGUMENTS").slice(0, 120),
      reason: String(error?.message || "Invalid causal tool arguments").slice(0, 240),
    };
  }

  const modelId = cleanText(validated.model_id || "", 160);
  if (modelId && !graphDatasetIds(graph).has(modelId)) {
    return {
      allowed: false,
      code: "CAUSAL_DATASET_NOT_AUTHORIZED",
      reason: "The requested causal dataset is not in the published catalog.",
      modelId,
    };
  }

  const tenantId = cleanText(principal?.tenantId || PUBLIC_TENANT_ID, 160);
  if (tenantId !== PUBLIC_TENANT_ID && !principal?.authenticated) {
    return {
      allowed: false,
      code: "CAUSAL_PRINCIPAL_NOT_AUTHENTICATED",
      reason: "A non-public causal tenant requires an authenticated principal.",
      tenantId,
    };
  }

  return {
    allowed: true,
    code: "AUTHORIZED",
    reason: "Read-only causal tool request is authorized.",
    args: validated,
    principal: {
      authenticated: Boolean(principal?.authenticated),
      userId: principal?.userId || null,
      tenantId,
      role: principal?.role || "public",
    },
  };
}

export function buildJozCausalRunRecord({
  runId,
  requestId = null,
  conversationId = null,
  sessionKey = null,
  toolName = null,
  args = {},
  mode = "disabled",
  authorization = null,
} = {}) {
  return {
    runId: cleanText(runId, 120) || null,
    requestId: cleanText(requestId, 120) || null,
    conversationId: cleanText(conversationId, 160) || null,
    sessionKey: cleanText(sessionKey, 160) || null,
    toolName: cleanText(toolName, 160) || null,
    args: args && typeof args === "object" ? args : {},
    mode: cleanText(mode, 80) || "disabled",
    status: "authorized",
    authorization: authorization || null,
    result: null,
    errorCode: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
}

export function completeJozCausalRunRecord(record, {
  status = "completed",
  result = null,
  errorCode = null,
} = {}) {
  return {
    ...(record || {}),
    status: cleanText(status, 80) || "completed",
    result: result || null,
    errorCode: cleanText(errorCode, 160) || null,
    completedAt: new Date().toISOString(),
  };
}
