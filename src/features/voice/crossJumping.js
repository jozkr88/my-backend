const MEET_JOZ_LAYERS = new Set(["vibe", "discover", "skills"]);
const MEET_JOZ_ACTION_ALIASES = {
  flex: "vibe",
  flax: "vibe",
  flecks: "vibe",
  flux: "vibe",
  plex: "vibe",
  ascend: "discover",
  ascent: "discover",
  accent: "discover",
  "a send": "discover",
  send: "discover",
  offend: "discover",
  assend: "discover",
  mogg: "skills",
  mgg: "skills",
  mogs: "skills",
  mog: "skills",
  mark: "skills",
  mug: "skills",
  mocha: "skills",
  moch: "skills",
  skill: "skills",
};

function portalIdFromValue(value) {
  const text = String(value || "").toLowerCase().trim();
  if (text.includes("meet-joz")) return "meet-joz";
  if (text.includes("maxx")) return "maxx";
  if (text.includes("the-vibe-energy")) return "the-vibe-energy";
  if (text === "/" || text === "root" || !text) return "root";
  return text.replace(/^\//, "").split("/").pop() || "root";
}

export function getCrossJumpSequence({
  sourcePortal,
  targetPortal,
  action,
  deferredNavigation = false,
} = {}) {
  const source = portalIdFromValue(sourcePortal);
  const target = portalIdFromValue(targetPortal);
  const rawLayer = String(action || "").toLowerCase().trim();
  const layer = MEET_JOZ_ACTION_ALIASES[rawLayer] || rawLayer;

  if (
    target !== "meet-joz" ||
    (source === "meet-joz" && !deferredNavigation)
  ) {
    return null;
  }
  if (!MEET_JOZ_LAYERS.has(layer)) return null;

  if (layer === "vibe") return ["vibe"];
  if (layer === "discover") return ["vibe", "discover_crossjump"];
  return ["vibe", "discover", "skills"];
}
