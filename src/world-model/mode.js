export function isWorldModelShadowEnabled() {
  const configured = String(
    typeof process !== "undefined" && process.env?.REACT_APP_JOZ_WORLD_MODEL_MODE
      ? process.env.REACT_APP_JOZ_WORLD_MODEL_MODE
      : typeof window !== "undefined" && window.__JOZ_WORLD_MODEL_MODE
        ? window.__JOZ_WORLD_MODEL_MODE
        : "off"
  ).trim().toLowerCase();
  return !["off", "disabled"].includes(configured);
}
