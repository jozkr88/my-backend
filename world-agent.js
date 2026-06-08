import {
  SITE_TARGETS,
  canonicalTargetForMesh,
  hasPhrase,
  normalizeAction,
  normalizeMeshName,
  safeTarget,
} from "./think-logic.js";

const BASE_ALIASES = {
  brain: [
    "enter",
    "explore",
    "go inside",
    "step inside",
    "open portal",
    "open the portal",
    "open maxx",
    "enter maxx",
    "enter the brain",
    "go inside the brain",
    "open the brain",
    "inside the brain",
    "enter the mind",
    "open the mind",
    "show philosophy",
    "open philosophy",
  ],
  ball: [
    "meet joz",
    "neo meet joz",
    "talk to joz",
    "open meet joz",
    "go to meet joz",
    "open ball",
    "go to ball",
  ],
  vibe: ["vibe", "flex", "open flex", "show flex"],
  discover: ["discover", "ascend", "open ascend", "show ascend"],
  skills: ["skills", "mogg", "show mogg", "open mogg", "show skills", "open skills"],
  pause: ["pause", "stop", "pause neurons", "stop neurons", "pause animation", "stop animation"],
  resume: [
    "play",
    "resume",
    "continue",
    "start",
    "resume neurons",
    "play neurons",
    "start neurons",
    "resume animation",
    "play animation",
  ],
  back: ["back", "go back", "previous", "step back", "return"],
  exit: ["exit", "leave", "leave portal", "close portal", "close joz", "exit joz", "leave joz"],
  launch: [
    "launch in space",
    "open in space",
    "view in space",
    "view in ar",
    "launch ar",
    "show in space",
    "space maxx",
  ],
};

const DEFAULT_ALLOWED_ACTIONS = {
  root: ["brain", "ball"],
  "meet-joz": ["vibe", "discover", "skills", "pause", "resume", "back", "vibe_back", "vibe_back1", "launch_in_space_workf"],
  "the-vibe-energy": ["n2x_pause", "n2x_resume", "back", "launch_in_space_n2x"],
  maxx: ["n2x_pause", "n2x_resume", "back", "launch_in_space_n2x"],
};

const PORTAL_TARGETS = {
  brain: SITE_TARGETS.maxx,
  ball: SITE_TARGETS.meetJoz,
};

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.values(value);
}

function toMemoryEntries(worldMemory) {
  if (!worldMemory || typeof worldMemory !== "object" || Array.isArray(worldMemory)) return [];
  return Object.entries(worldMemory).map(([mesh, value]) => ({
    mesh,
    ...value,
  }));
}

function normalizeToken(value) {
  return String(value || "").toLowerCase().trim();
}

function collectAliasesForMesh(mesh, worldMap, worldMemory) {
  const normalizedMesh = normalizeMeshName(mesh) || normalizeToken(mesh);
  const aliases = new Set(BASE_ALIASES[normalizedMesh] || []);

  for (const entry of toArray(worldMap)) {
    const entryMesh = normalizeMeshName(entry?.mesh) || normalizeToken(entry?.mesh);
    if (entryMesh !== normalizedMesh) continue;
    for (const synonym of entry?.synonyms || []) aliases.add(normalizeToken(synonym));
    if (entry?.name) aliases.add(normalizeToken(entry.name));
    if (entry?.description) aliases.add(normalizeToken(entry.description));
  }

  for (const entry of toMemoryEntries(worldMemory)) {
    const entryMesh = normalizeMeshName(entry?.mesh) || normalizeToken(entry?.mesh);
    if (entryMesh !== normalizedMesh) continue;
    for (const command of entry?.commands || []) aliases.add(normalizeToken(command));
    if (entry?.action) aliases.add(normalizeToken(entry.action));
  }

  return Array.from(aliases).filter(Boolean);
}

function getAllowedActions(currentPortal, agentContext) {
  const structured = Array.isArray(agentContext?.structuredAvailableActions)
    ? agentContext.structuredAvailableActions.map((value) => normalizeAction(value) || normalizeToken(value)).filter(Boolean)
    : null;
  const explicit = Array.isArray(agentContext?.allowedActions)
    ? agentContext.allowedActions.map((value) => normalizeAction(value) || normalizeToken(value)).filter(Boolean)
    : null;

  if (structured?.length) return new Set(structured);
  if (explicit?.length) return new Set(explicit);
  return new Set(DEFAULT_ALLOWED_ACTIONS[currentPortal] || []);
}

function resolveStructuredTransition(clean, allowedActions, structuredState) {
  const transitions = Array.isArray(structuredState?.transitions) ? structuredState.transitions : [];

  for (const transition of transitions) {
    const action = normalizeAction(transition?.action) || normalizeToken(transition?.action);
    if (!action || !allowedActions.has(action)) continue;
    const phrases = Array.isArray(transition?.phrases)
      ? transition.phrases.map((value) => normalizeToken(value)).filter(Boolean)
      : [];
    if (!phrases.length || !hasPhrase(clean, phrases)) continue;
    return {
      action,
      target: safeTarget(transition?.target),
      awareness: transition?.awareness || null,
    };
  }

  return null;
}

function resolveBackAction({ currentPortal, currentMesh, allowedActions, clean }) {
  if (!hasPhrase(clean, [...BASE_ALIASES.back, ...BASE_ALIASES.exit])) {
    return null;
  }

  if (allowedActions.has("vibe_back1")) {
    return { action: "vibe_back1", target: null };
  }

  if (allowedActions.has("vibe_back")) {
    const mesh = normalizeMeshName(currentMesh);
    return {
      action: "vibe_back",
      target: currentPortal === "meet-joz" && mesh === "vibe" ? "/" : null,
    };
  }

  if (allowedActions.has("back")) {
    return {
      action: "back",
      target: currentPortal === "root" ? null : "/",
    };
  }

  return {
    action: null,
    target: null,
    awareness: "That step is not available from the current state.",
  };
}

function resolveBinaryAction(clean, allowedActions) {
  if (hasPhrase(clean, BASE_ALIASES.pause)) {
    if (allowedActions.has("n2x_pause")) return { action: "n2x_pause", target: null };
    if (allowedActions.has("pause")) return { action: "pause", target: null };
    return { action: null, target: null, awareness: "That step is not available from the current state." };
  }

  if (hasPhrase(clean, BASE_ALIASES.resume)) {
    if (allowedActions.has("n2x_resume")) return { action: "n2x_resume", target: null };
    if (allowedActions.has("resume")) return { action: "resume", target: null };
    return { action: null, target: null, awareness: "That step is not available from the current state." };
  }

  if (hasPhrase(clean, BASE_ALIASES.launch)) {
    if (allowedActions.has("launch_in_space_n2x")) return { action: "launch_in_space_n2x", target: null };
    if (allowedActions.has("launch_in_space_workf")) return { action: "launch_in_space_workf", target: null };
    return { action: null, target: null, awareness: "That step is not available from the current state." };
  }

  return null;
}

function buildInteractiveCandidates(currentPortal, worldMap, worldMemory, agentContext) {
  const knownMeshes = Array.isArray(agentContext?.knownInteractiveMeshes)
    ? agentContext.knownInteractiveMeshes
    : currentPortal === "root"
      ? ["brain", "ball"]
      : currentPortal === "meet-joz"
        ? ["vibe", "discover", "skills"]
        : currentPortal === "the-vibe-energy" || currentPortal === "maxx"
          ? ["n2x"]
          : [];

  return knownMeshes.map((mesh) => {
    const normalizedMesh = normalizeMeshName(mesh) || normalizeToken(mesh);
    const memoryEntry = toMemoryEntries(worldMemory).find(
      (entry) => (normalizeMeshName(entry?.mesh) || normalizeToken(entry?.mesh)) === normalizedMesh,
    );

    const action = normalizeAction(memoryEntry?.action) || normalizedMesh;

    return {
      mesh: normalizedMesh,
      action,
      target: safeTarget(memoryEntry?.context?.target) || PORTAL_TARGETS[normalizedMesh] || canonicalTargetForMesh(normalizedMesh),
      aliases: collectAliasesForMesh(normalizedMesh, worldMap, worldMemory),
    };
  });
}

export function resolveAgenticAction({ clean, currentPortal, currentMesh, agentContext, worldMap, worldMemory }) {
  const allowedActions = getAllowedActions(currentPortal, agentContext);
  const structuredTransition = resolveStructuredTransition(clean, allowedActions, agentContext?.structuredState);
  if (structuredTransition) return structuredTransition;

  const backResult = resolveBackAction({ currentPortal, currentMesh, allowedActions, clean });
  if (backResult) return backResult;

  const binaryResult = resolveBinaryAction(clean, allowedActions);
  if (binaryResult) return binaryResult;

  const candidates = buildInteractiveCandidates(currentPortal, worldMap, worldMemory, agentContext);

  for (const candidate of candidates) {
    if (!candidate.aliases.length || !hasPhrase(clean, candidate.aliases)) continue;

    if (!allowedActions.has(candidate.action)) {
      return {
        action: null,
        target: null,
        awareness: "That step is not available from the current state.",
      };
    }

    return {
      action: candidate.action,
      target: candidate.target,
    };
  }

  return null;
}
