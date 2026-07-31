import { apiUrl, fetchJson } from "../utils/api";
import { isWorldModelShadowEnabled } from "./mode";

export const WHOLE_APP_WORLD_MODEL_VERSION = "whole-app-world-state-v1";
export const WHOLE_APP_TRANSITION_RULE_VERSION = "whole-app-journey-v1";

const SESSION_STORAGE_KEY = "joz-world-model-session-v1";

function clean(value, fallback = null, maxLength = 96) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:/.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
  return normalized || fallback;
}

function randomId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSessionId() {
  if (typeof window === "undefined") return null;
  if (window.__worldModelJourneySessionId) return window.__worldModelJourneySessionId;

  let sessionId = null;
  try {
    sessionId = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) {
      sessionId = randomId("journey");
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }
  } catch {
    sessionId = randomId("journey");
  }

  window.__worldModelJourneySessionId = sessionId;
  return sessionId;
}

function dayPartForHour(hour) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "workday";
  if (hour >= 18 && hour < 23) return "evening";
  return "night";
}

function detectDevice() {
  if (typeof navigator === "undefined") return "unknown";
  const userAgent = navigator.userAgent || "";
  if (/ipad|iphone|ipod/i.test(userAgent)) return "ios";
  if (/android/i.test(userAgent)) return "android";
  return "desktop";
}

function detectBrowser() {
  if (typeof navigator === "undefined") return "unknown";
  const userAgent = navigator.userAgent || "";
  if (/firefox/i.test(userAgent)) return "firefox";
  if (/edg\//i.test(userAgent)) return "edge";
  if (/chrome|crios/i.test(userAgent)) return "chrome";
  if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) return "safari";
  return "other";
}

function inferAudience({ audience, goal, action } = {}) {
  const query = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const candidate = query?.get("audience") || query?.get("persona") || audience;
  const normalized = clean(candidate);
  if (["business", "recruiter", "explorer"].includes(normalized)) return normalized;

  const text = `${goal || ""} ${action || ""}`.toLowerCase();
  if (/recruit|hire|talent|business|value|roi|commercial/.test(text)) return "business";
  if (/skill|neuron|brain|spatial|ar|explore/.test(text)) return "explorer";
  return "general";
}

export function inferWholeAppGoal({ action, target, goal } = {}) {
  const explicit = clean(goal, null, 120);
  if (explicit) return explicit;

  const text = `${action || ""} ${target || ""}`.toLowerCase();
  if (/callback|contact|call|booking|email|message/.test(text)) return "connect_with_joz";
  if (/business|discover|value|roi/.test(text)) return "understand_business_value";
  if (/skill|mogg/.test(text)) return "explore_skills";
  if (/neuron|brain|maxx/.test(text)) return "explore_neurons";
  if (/ar|spatial|qr/.test(text)) return "launch_spatial_experience";
  if (/question|ask|chat|message/.test(text)) return "get_an_answer";
  if (/navigate|portal|route|state/.test(text)) return "explore_the_world";
  return "explore_the_world";
}

function pathPortal(path, fallback) {
  const match = String(path || "").match(/^\/neo\/([^/]+)/i);
  return clean(match?.[1] || fallback, "root");
}

function meshValue(mesh) {
  if (mesh && typeof mesh === "object") {
    return clean(mesh.id || mesh.name || mesh.mesh);
  }
  return clean(mesh);
}

export function buildWholeAppWorldState({ appState = {}, overrides = {} } = {}) {
  const source = appState && typeof appState === "object" ? appState : {};
  const path = overrides.path || source.currentPath || (typeof window !== "undefined" ? window.location.pathname : "/");
  const portal = pathPortal(path, overrides.portal || source.currentPortal);
  const mesh = meshValue(overrides.mesh ?? source.currentMesh);
  const stage = clean(overrides.stage ?? source.currentMeshStage);
  const phase = clean(overrides.phase ?? source.voiceState?.currentPhase);
  const uiState = source.uiState || {};
  const allowedActions = Array.isArray(overrides.allowedActions)
    ? overrides.allowedActions
    : Array.isArray(source.allowedActions)
      ? source.allowedActions
      : [];
  const safeAllowedActions = allowedActions
    .map((action) => clean(typeof action === "string" ? action : action?.type))
    .filter(Boolean)
    .slice(0, 32);
  const currentStateKey = clean(
    overrides.currentStateKey || source.currentStateKey || `${portal}:${mesh || "idle"}:${stage || "idle"}`,
    "root:idle",
    160
  );
  const goal = inferWholeAppGoal({
    action: overrides.action,
    target: overrides.target,
    goal: overrides.goal || source.userContext?.goal,
  });

  return {
    currentStateKey,
    portal,
    path: clean(path, "/", 180),
    mesh,
    stage,
    phase,
    audience: inferAudience({ audience: overrides.audience, goal, action: overrides.action }),
    goal,
    device: clean(overrides.device, detectDevice()),
    browser: clean(overrides.browser, detectBrowser()),
    dayPart: dayPartForHour(new Date().getHours()),
    isMobile: Boolean(overrides.isMobile ?? uiState.isMobile),
    arSupported: Boolean(overrides.arSupported ?? uiState.arSupported),
    allowedActions: safeAllowedActions,
    modelBoundary: "app-state-and-user-journey-observation",
  };
}

function currentAppState() {
  if (typeof window === "undefined") return {};
  return window.__appState || {};
}

export function recordWholeAppJourneyEvent({
  action,
  target = null,
  source = "app",
  outcomeType = "action_observed",
  goal = null,
  audience = null,
  appState = null,
  stateBefore = null,
  observedState = null,
  expectedEffects = [],
  observedEffects = [],
  success = true,
} = {}) {
  if (typeof window === "undefined" || !isWorldModelShadowEnabled()) return Promise.resolve(null);

  const normalizedAction = clean(action, "unknown_action", 96);
  const normalizedSource = clean(source, "app", 48);
  const normalizedOutcome = clean(outcomeType, "action_observed", 64);
  const before = stateBefore || buildWholeAppWorldState({
    appState: appState || currentAppState(),
    overrides: { action: normalizedAction, target, goal, audience },
  });
  const after = observedState || buildWholeAppWorldState({
    appState: appState || currentAppState(),
    overrides: { action: normalizedAction, target, goal, audience },
  });
  const sessionId = getSessionId();
  const trajectoryId = randomId("whole-app");
  const observedAt = new Date().toISOString();

  return fetchJson(apiUrl("/api/world-model/trajectories"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trajectoryId,
      sessionId,
      traceId: sessionId,
      stateBefore: before,
      proposedAction: { type: normalizedAction, target, source: normalizedSource },
      symbolicPrediction: {
        modelVersion: WHOLE_APP_WORLD_MODEL_VERSION,
        selectedAction: normalizedAction,
        source: "observed_app_event",
      },
      expectedEffects,
      observedState: {
        ...after,
        outcomeType: normalizedOutcome,
      },
      observedEffects: [
        ...observedEffects,
        { type: "whole_app_event", action: normalizedAction, outcome: normalizedOutcome },
      ],
      intent: "whole_app_journey",
      goal: inferWholeAppGoal({ action: normalizedAction, target, goal }),
      interactionChannel: normalizedSource,
      success: success === true,
      outcomeScores: {
        eventObserved: 1,
        outcomeType: normalizedOutcome,
        audience: before.audience,
      },
      modelVersion: WHOLE_APP_WORLD_MODEL_VERSION,
      transitionRuleVersion: WHOLE_APP_TRANSITION_RULE_VERSION,
      sampled: true,
      consentCompatible: true,
      observedAt,
    }),
  });
}
