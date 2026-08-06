import {
  getJozCausalToolDefinitions,
  validateJozCausalToolArguments,
} from "./jozCausalToolRegistry.js";
import { loadPublishedJozKnowledgeGraph } from "./jozKnowledgeGraph.js";

function cleanText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isModelAvailable(model = null) {
  if (!model) return false;
  if (typeof model.isAvailable === "function") return model.isAvailable();
  return true;
}

export function isLikelyJozCausalToolRequest(input = "") {
  const text = cleanText(input).toLowerCase();
  return Boolean(
    text &&
    /\b(caus(?:e|al)|intervention|counterfactual|what if|influence|affect(?:s|ed)?|assumption|refut(?:e|ation)|evidence|causal path|causal chain|model version)\b/.test(text)
  );
}

function buildCausalCatalog(graph) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  return {
    models: nodes
      .filter((node) => node.type === "causal_dataset")
      .slice(0, 12)
      .map((node) => ({ model_id: node.id.replace(/^causal_dataset:/, ""), label: node.label })),
    model_versions: nodes
      .filter((node) => node.type === "causal_model_version")
      .slice(0, 12)
      .map((node) => ({ model_version: node.label || node.id.replace(/^causal_model_version:/, "") })),
    variables: nodes
      .filter((node) => node.type === "causal_variable")
      .slice(0, 120)
      .map((node) => ({ variable_id: node.label, id: node.id })),
    claims: nodes
      .filter((node) => node.type === "causal_claim")
      .slice(0, 80)
      .map((node) => ({ relationship_id: node.label, id: node.id })),
  };
}

function toolPayloads() {
  return getJozCausalToolDefinitions().map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function buildJozCausalToolSelectionPrompt() {
  return [
    "You are the Joz MAXX causal-tool selector.",
    "Select at most one registered read-only causal tool for the user's latest message.",
    "Do not answer the user and do not invent causal facts.",
    "Use only identifiers from the supplied causal catalog.",
    "If the request does not clearly require one of the tools, return no tool call.",
    "The application will independently validate every argument and may reject the request.",
  ].join(" ");
}

export async function selectJozCausalTool({
  model = null,
  input = "",
  messages = [],
  context = {},
  graph = loadPublishedJozKnowledgeGraph(),
} = {}) {
  if (!isLikelyJozCausalToolRequest(input)) {
    return { status: "not_applicable", toolName: null, args: null, errorCode: null };
  }
  if (!isModelAvailable(model)) {
    return { status: "unavailable", toolName: null, args: null, errorCode: "MODEL_UNAVAILABLE" };
  }

  try {
    const response = await model.chat.completions.create({
      model: process.env.JOZ_CAUSAL_TOOL_MODEL || process.env.JOZ_INTENT_MODEL || "gpt-4o-mini",
      temperature: 0,
      max_tokens: 260,
      tools: toolPayloads(),
      tool_choice: "auto",
      messages: [
        { role: "system", content: buildJozCausalToolSelectionPrompt() },
        {
          role: "user",
          content: JSON.stringify({
            latestMessage: cleanText(input).slice(0, 2000),
            recentMessages: messages.slice(-4).map((message) => ({
              role: message?.role === "assistant" ? "assistant" : "user",
              content: cleanText(message?.content).slice(0, 600),
            })),
            context: {
              activeModelId: cleanText(context?.activeModelId || context?.active_model_id) || null,
              activeModelVersion: cleanText(context?.activeModelVersion || context?.active_model_version) || null,
            },
            causalCatalog: buildCausalCatalog(graph),
          }),
        },
      ],
    });
    const message = response?.choices?.[0]?.message || {};
    const call = Array.isArray(message.tool_calls) ? message.tool_calls[0] : null;
    if (!call?.function?.name) {
      return { status: "no_tool", toolName: null, args: null, errorCode: null };
    }

    const toolName = cleanText(call.function.name);
    let args;
    try {
      args = JSON.parse(call.function.arguments || "{}");
    } catch {
      return { status: "invalid", toolName, args: null, errorCode: "INVALID_TOOL_ARGUMENTS_JSON" };
    }
    try {
      const validated = validateJozCausalToolArguments(toolName, args);
      return { status: "selected", toolName, args: validated, errorCode: null };
    } catch (error) {
      return {
        status: "invalid",
        toolName,
        args: null,
        errorCode: String(error?.code || "INVALID_TOOL_ARGUMENTS").slice(0, 120),
      };
    }
  } catch (error) {
    return {
      status: "failed",
      toolName: null,
      args: null,
      errorCode: String(error?.code || error?.message || "CAUSAL_TOOL_SELECTION_FAILED").slice(0, 160),
    };
  }
}
