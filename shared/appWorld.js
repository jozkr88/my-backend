import { normalizeVoiceAction } from "./voiceActions.js";

export const CONTACT_UTILITY_ACTIONS = [
  "contact_joz",
  "call_joz",
  "show_contact_buttons",
  "hide_contact_buttons",
];

export const ROOT_ALLOWED_ACTIONS = ["brain", "ball"];
export const MAXX_ALLOWED_ACTIONS = [
  "n2x_pause",
  "n2x_resume",
  "back",
  "launch_in_space_n2x",
];

export const MEET_JOZ_ALLOWED_ACTIONS_BY_LAYER = {
  vibe: ["vibe", "skills", "vibe_back", "pause", "resume", "back", "launch_in_space_workf"],
  discover: ["discover", "skills", "vibe_back", "pause", "resume", "back", "launch_in_space_workf"],
  skills: ["skills", "vibe_back1", "pause", "resume", "back", "launch_in_space_workf"],
  default: ["vibe", "discover", "skills", "pause", "resume", "back", "launch_in_space_workf"],
};

export function getMeetJozAllowedActions(layer, { includeUtilityActions = false } = {}) {
  const normalizedLayer = String(layer || "").toLowerCase().trim();
  const base =
    MEET_JOZ_ALLOWED_ACTIONS_BY_LAYER[normalizedLayer] ||
    MEET_JOZ_ALLOWED_ACTIONS_BY_LAYER.default;

  return includeUtilityActions ? [...base, ...CONTACT_UTILITY_ACTIONS] : [...base];
}

export function getAllowedActionsForPortalState(
  currentPortal,
  {
    meetJozLayer = null,
    includeUtilityActions = false,
  } = {}
) {
  const portal = String(currentPortal || "").toLowerCase().trim();

  if (portal === "root") {
    const base = [...ROOT_ALLOWED_ACTIONS];
    return includeUtilityActions ? [...base, ...CONTACT_UTILITY_ACTIONS] : base;
  }

  if (portal === "meet-joz") {
    return getMeetJozAllowedActions(meetJozLayer, { includeUtilityActions });
  }

  if (portal === "the-vibe-energy" || portal === "maxx") {
    const base = [...MAXX_ALLOWED_ACTIONS];
    return includeUtilityActions ? [...base, ...CONTACT_UTILITY_ACTIONS] : base;
  }

  return [];
}

export function isMeetJozActionAllowed(layer, action, options = {}) {
  const normalizedAction = normalizeVoiceAction(action) || String(action || "").toLowerCase().trim();
  if (!normalizedAction) return false;

  return getMeetJozAllowedActions(layer, options).includes(normalizedAction);
}
