import {
  APP_CONTEXT,
  getWorldContext,
  normalizeAction,
  normalizeMeshName,
  normalizeTranscript,
  safeTarget,
} from "./think-logic.js";
import { resolveAgenticAction } from "./world-agent.js";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toEntries(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value);
}

function summarizeWorldMemory(worldMemory, knownMeshes = []) {
  const known = new Set(knownMeshes.map((value) => normalizeMeshName(value) || String(value || "").toLowerCase().trim()).filter(Boolean));

  return toEntries(worldMemory)
    .filter(([mesh]) => !known.size || known.has(normalizeMeshName(mesh) || String(mesh || "").toLowerCase().trim()))
    .slice(0, 12)
    .map(([mesh, value]) => ({
      mesh,
      commands: toArray(value?.commands).slice(0, 10),
      target: safeTarget(value?.context?.target),
      action: String(value?.action || "").trim() || null,
    }));
}

export function buildAgentSnapshot({ input, context, worldMap, worldMemory }) {
  const currentPortal = context?.currentPortal || context?.portal || "root";
  const currentMesh = normalizeMeshName(context?.currentMesh || context?.mesh || "");

  return {
    input: String(input || "").trim(),
    normalizedInput: normalizeTranscript(input),
    appContext: APP_CONTEXT,
    worldContext: getWorldContext(currentPortal),
    currentPortal,
    currentMesh,
    currentPath: context?.currentPath || "/",
    allowedActions: toArray(context?.allowedActions),
    structuredState: context?.structuredState || null,
    knownInteractiveMeshes: toArray(context?.knownInteractiveMeshes),
    uiState: context?.uiState || {},
    voiceState: context?.voiceState || {},
    worldMap: toArray(worldMap).slice(0, 24),
    worldMemory: summarizeWorldMemory(worldMemory, context?.knownInteractiveMeshes),
  };
}

export function approveAgentProposal({ clean, context, worldMap, worldMemory, proposal = null }) {
  const deterministic = resolveAgenticAction({
    clean,
    currentPortal: context?.currentPortal || context?.portal || "root",
    currentMesh: context?.currentMesh || context?.mesh || null,
    agentContext: context || {},
    worldMap,
    worldMemory,
  });

  if (deterministic) {
    return {
      action: deterministic.action ?? null,
      target: deterministic.target ?? null,
      awareness: deterministic.awareness ?? null,
      source: "deterministic",
    };
  }

  const normalizedAction = normalizeAction(proposal?.proposedAction || proposal?.action);
  const normalizedTarget = safeTarget(proposal?.proposedTarget || proposal?.target);
  const allowedActions = new Set(toArray(context?.allowedActions).map((value) => normalizeAction(value)).filter(Boolean));
  const utilityActions = new Set([
    "contact_joz",
    "call_joz",
    "hide_contact_buttons",
    "show_contact_buttons",
  ]);

  if (!normalizedAction && !normalizedTarget) {
    return {
      action: null,
      target: null,
      awareness: proposal?.response || proposal?.awareness || null,
      source: "agent_noop",
    };
  }

  if (normalizedAction && allowedActions.size && !allowedActions.has(normalizedAction) && !utilityActions.has(normalizedAction)) {
    return {
      action: null,
      target: null,
      awareness: "That step is not available from the current state.",
      source: "agent_blocked",
    };
  }

  return {
    action: normalizedAction,
    target: normalizedTarget,
    awareness: proposal?.response || proposal?.awareness || null,
    source: "agent_proposal",
  };
}

export function buildFallbackAgentReply({ approved, snapshot }) {
  if (approved?.awareness) return approved.awareness;

  if (approved?.action || approved?.target) {
    return `I understood that in ${snapshot.currentPortal}.`;
  }

  return `I'm aware you're in ${snapshot.currentPortal}. Ask for one of the available world actions.`;
}
