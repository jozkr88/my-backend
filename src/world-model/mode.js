export function isWorldModelShadowEnabled() {
  const isLocalDevelopment =
    typeof window !== "undefined" &&
    /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  const configured = String(
    typeof process !== "undefined" && process.env?.REACT_APP_JOZ_WORLD_MODEL_MODE
      ? process.env.REACT_APP_JOZ_WORLD_MODEL_MODE
      : typeof window !== "undefined" && window.__JOZ_WORLD_MODEL_MODE
        ? window.__JOZ_WORLD_MODEL_MODE
        : isLocalDevelopment
          ? "shadow"
          : "off"
  ).trim().toLowerCase();
  return !["off", "disabled"].includes(configured);
}
