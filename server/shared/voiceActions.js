export const KNOWN_VOICE_ACTIONS = new Set([
  "brain",
  "ball",
  "vibe",
  "discover",
  "skills",
  "pause",
  "resume",
  "back",
  "vibe_back",
  "vibe_back1",
  "n2x_pause",
  "n2x_resume",
  "launch_in_space_n2x",
  "launch_in_space_workf",
  "hide_contact_buttons",
  "show_contact_buttons",
  "contact_joz",
  "call_joz",
]);

export const BLOCKED_GLB_FALLBACK_ACTIONS = new Set([
  "brain",
  "enter",
  "maxx",
  "ball",
  "meet-joz",
  "meet joz",
  "vibe",
  "discover",
  "skills",
  "back",
  "back1",
  "vibe_back",
  "vibe_back1",
  "pause",
  "resume",
  "launch_in_space_n2x",
  "launch_in_space_workf",
  "contact_joz",
  "call_joz",
  "show_contact_buttons",
  "hide_contact_buttons",
]);

export function normalizeVoiceAction(action) {
  const lower = String(action || "").toLowerCase().trim();
  if (!lower) return null;
  if (lower === "flex") return "vibe";
  if (lower === "ascend") return "discover";
  if (lower === "mogg") return "skills";
  return KNOWN_VOICE_ACTIONS.has(lower) ? lower : null;
}
