import { apiUrl, fetchJson } from "../utils/api";

const AR_DECISION_STORE_KEY = "__worldModelArDecisions";
const AR_DECISION_MODEL_VERSION = "ar-delivery-empirical-v1";

function clean(value, fallback = "unknown", maxLength = 64) {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
  return normalized || fallback;
}

function detectBrowser() {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  if (/firefox/i.test(ua)) return "firefox";
  if (/edg\//i.test(ua)) return "edge";
  if (/chrome|crios/i.test(ua)) return "chrome";
  if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) return "safari";
  return "other";
}

function detectDevice() {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  if (/ipad|iphone|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

function getLoadMetrics() {
  if (typeof window === "undefined") return {};
  return window.__worldModelLoadMetrics || {};
}

export function buildArDecisionContext({
  entitySet,
  currentPortal = "root",
  isMobile = false,
  arSupported = false,
} = {}) {
  const loadMetrics = getLoadMetrics();
  return {
    entitySet: clean(entitySet),
    currentPortal: clean(currentPortal, "root"),
    device: detectDevice(),
    browser: detectBrowser(),
    isMobile: Boolean(isMobile),
    arSupported: Boolean(arSupported),
    loadMs: Number.isFinite(Number(loadMetrics.loadMs))
      ? Math.max(0, Math.round(Number(loadMetrics.loadMs)))
      : null,
    viewport: typeof window !== "undefined"
      ? {
          width: window.innerWidth || null,
          height: window.innerHeight || null,
          pixelRatio: window.devicePixelRatio || null,
        }
      : {},
  };
}

export async function requestArDecision(context = {}) {
  return fetchJson(apiUrl("/api/world-model/ar-decision"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(context),
  });
}

export function cacheArDecision(decision) {
  if (typeof window === "undefined" || !decision?.entitySet) return;
  const existing = window[AR_DECISION_STORE_KEY] || {};
  window[AR_DECISION_STORE_KEY] = {
    ...existing,
    [decision.entitySet]: decision,
  };
}

export function getCachedArDecision(entitySet) {
  if (typeof window === "undefined") return null;
  return window[AR_DECISION_STORE_KEY]?.[entitySet] || null;
}

export function buildFallbackArDecision({
  entitySet,
  currentPortal = "root",
  isMobile = false,
  arSupported = false,
} = {}) {
  const context = buildArDecisionContext({
    entitySet,
    currentPortal,
    isMobile,
    arSupported,
  });
  const stateKey = [
    "ar-delivery",
    context.entitySet,
    context.device,
    context.browser,
    context.arSupported ? "supported" : "unsupported",
    context.currentPortal,
  ].join(":");

  return {
    decisionId: `fallback-${Date.now()}`,
    trajectoryId: null,
    modelVersion: "deterministic-fallback-v1",
    entitySet: context.entitySet,
    stateKey,
    selectedAction: context.arSupported && context.isMobile ? "direct_ar" : "web_preview",
    confidence: 0.5,
    source: "deterministic_fallback",
    candidates: [],
  };
}

export function trackArHandoff({
  decision,
  entitySet,
  action,
  currentPortal = "root",
} = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  let finalized = false;
  const startedAt = Date.now();
  let timeoutId = null;

  const cleanup = () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("pagehide", handlePageHide);
    if (timeoutId) window.clearTimeout(timeoutId);
  };

  const finalize = (success, outcome) => {
    if (finalized) return;
    finalized = true;
    cleanup();

    void fetchJson(apiUrl("/api/world-model/trajectories"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trajectoryId:
          `${decision?.trajectoryId || `ar-delivery-${decision?.decisionId || "fallback"}`}-${Date.now()}`,
        traceId: decision?.decisionId || null,
        stateBefore: {
          currentStateKey: decision?.stateKey || null,
          portal: "ar-delivery",
          focusedEntityId: entitySet,
          device: decision?.context?.device || null,
          browser: decision?.context?.browser || null,
          currentPortal,
        },
        proposedAction: {
          type: action,
          entitySet,
        },
        symbolicPrediction: {
          modelVersion: decision?.modelVersion || AR_DECISION_MODEL_VERSION,
          selectedAction: action,
          confidence: decision?.confidence || 0.5,
          candidates: decision?.candidates || [],
        },
        expectedEffects: [{ type: "ar_handoff", action, entitySet }],
        observedState: {
          currentStateKey: `${decision?.stateKey || "ar-delivery"}:outcome:${outcome}`,
          portal: "ar-delivery",
          stage: outcome,
          focusedEntityId: entitySet,
          currentPortal,
        },
        observedEffects: [{ type: "ar_handoff", outcome, entitySet }],
        observationDifference: { matches: success, differences: [] },
        intent: "spatial_ar_delivery",
        goal: "deliver_spatial_model",
        interactionChannel: "world_model_button",
        transitionDurationMs: Math.max(0, Date.now() - startedAt),
        success,
        confidenceBeforeAction: decision?.confidence || 0.5,
        outcomeScores: {
          handoffSuccess: success ? 1 : 0,
          outcome,
        },
        modelVersion: decision?.modelVersion || AR_DECISION_MODEL_VERSION,
        sampled: true,
        consentCompatible: true,
        observedAt: new Date().toISOString(),
      }),
    }).catch((error) => {
      console.warn("⚠️ AR delivery outcome recording failed:", error?.message || error);
    });
  };

  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      finalize(true, "handoff_started");
    }
  }

  function handlePageHide() {
    finalize(true, "page_left_for_handoff");
  }

  document.addEventListener("visibilitychange", handleVisibilityChange, { once: true });
  window.addEventListener("pagehide", handlePageHide, { once: true });
  timeoutId = window.setTimeout(() => finalize(false, "handoff_not_observed"), 8000);

  return cleanup;
}
