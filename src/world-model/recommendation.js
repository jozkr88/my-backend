import { apiUrl, fetchJson } from "../utils/api";
import { buildArDecisionContext } from "./arDecision";

const ALLOWED_RECOMMENDATION_ACTIONS = ["show_skills", "show_neurons"];

function clean(value, fallback = "unknown", maxLength = 64) {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
  return normalized || fallback;
}

function dayPartForHour(hour) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "workday";
  if (hour >= 18 && hour < 23) return "evening";
  return "night";
}

function inferAudience(agentContext = {}) {
  const query = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const candidate = query?.get("audience") || query?.get("persona") || agentContext.audience;
  const normalized = clean(candidate, "explorer");
  if (["business", "recruiter", "explorer"].includes(normalized)) return normalized;
  return "explorer";
}

export function buildWorldModelRecommendationContext({
  currentPortal = "root",
  currentMesh = null,
  currentPhase = null,
  isMobile = false,
  arSupported = false,
  agentContext = {},
} = {}) {
  const arContext = buildArDecisionContext({
    entitySet: "joz_skills",
    currentPortal,
    isMobile,
    arSupported,
  });
  const hour = new Date().getHours();

  return {
    currentPortal: clean(currentPortal, "root"),
    currentMesh: clean(currentMesh),
    currentPhase: clean(currentPhase),
    device: arContext.device,
    browser: arContext.browser,
    isMobile: Boolean(isMobile),
    arSupported: Boolean(arSupported),
    dayPart: dayPartForHour(hour),
    audience: inferAudience(agentContext),
    loadMs: arContext.loadMs,
  };
}

export async function requestWorldModelRecommendations(context = {}) {
  const payload = await fetchJson(apiUrl("/api/world-model/recommendations"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(context),
  });
  const selectedActions = (Array.isArray(payload?.selectedActions) ? payload.selectedActions : [])
    .filter((action) => ALLOWED_RECOMMENDATION_ACTIONS.includes(action));
  return {
    ...payload,
    selectedActions: selectedActions.length
      ? selectedActions
      : ALLOWED_RECOMMENDATION_ACTIONS,
  };
}

export async function recordWorldModelRecommendationSelection({
  recommendation,
  context,
  action,
} = {}) {
  if (!recommendation?.stateKey || !ALLOWED_RECOMMENDATION_ACTIONS.includes(action)) return null;

  const candidate = recommendation.candidates?.find((item) => item.action === action) || null;
  const observedAt = new Date().toISOString();
  const trajectoryId = `${recommendation.recommendationId || "recommendation"}-${action}-${Date.now()}`;
  const stateBefore = {
    currentStateKey: recommendation.stateKey,
    portal: context?.currentPortal || "root",
    audience: context?.audience || "explorer",
    dayPart: context?.dayPart || "unknown",
    device: context?.device || "unknown",
    arSupported: context?.arSupported === true,
  };

  return fetchJson(apiUrl("/api/world-model/trajectories"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trajectoryId,
      traceId: recommendation.recommendationId || trajectoryId,
      stateBefore,
      proposedAction: { type: action },
      symbolicPrediction: {
        selectedAction: action,
        score: candidate?.score ?? null,
        probability: candidate?.probability ?? null,
        confidence: candidate?.confidence ?? null,
        candidates: recommendation.candidates || [],
      },
      expectedEffects: [{ type: "intro_recommendation", action }],
      observedState: {
        ...stateBefore,
        currentStateKey: `${recommendation.stateKey}:outcome:selected`,
        stage: "selected",
      },
      observedEffects: [{ type: "intro_recommendation_selected", action }],
      observationDifference: { matches: true, differences: [] },
      intent: "intro_recommendation",
      goal: "predict_next_user_action",
      interactionChannel: "world_model_button",
      success: true,
      confidenceBeforeAction: candidate?.confidence ?? null,
      outcomeScores: {
        recommendationSelected: 1,
        selectedAction: action,
      },
      modelVersion: recommendation.modelVersion || "contextual-intro-v1",
      sampled: true,
      consentCompatible: true,
      observedAt,
    }),
  });
}
