import { isWorldModelShadowEnabled } from "../../world-model/mode";
import { apiUrl as defaultApiUrl, fetchJson as defaultFetchJson } from "../../utils/api";

async function attachShadowPrediction({
  rawInput,
  context,
  fetchJson,
  apiUrl,
  localResult,
}) {
  const requestJson = typeof fetchJson === "function" ? fetchJson : defaultFetchJson;
  const buildApiUrl = typeof apiUrl === "function" ? apiUrl : defaultApiUrl;
  const isLocalDevelopment =
    typeof window !== "undefined" &&
    /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname) &&
    process.env.NODE_ENV !== "production";

  if (
    (!isWorldModelShadowEnabled() && !isLocalDevelopment) ||
    typeof requestJson !== "function" ||
    typeof buildApiUrl !== "function"
  ) {
    return localResult;
  }

  try {
    const agenticResult = await requestJson(buildApiUrl("/api/agentic"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: rawInput,
        context,
      }),
    });

    return {
      ...localResult,
      prediction: agenticResult?.prediction || null,
    };
  } catch (error) {
    console.warn("⚠️ Shadow prediction enrichment unavailable; continuing locally:", error?.message || error);
    return localResult;
  }
}

async function resolveBackendSpatialIntent({
  rawInput,
  context,
  fetchJson,
  apiUrl,
}) {
  const requestJson = typeof fetchJson === "function" ? fetchJson : defaultFetchJson;
  const buildApiUrl = typeof apiUrl === "function" ? apiUrl : defaultApiUrl;
  try {
    const payload = await requestJson(buildApiUrl("/api/world-model/spatial-intent"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: rawInput,
        context,
      }),
    });
    if (!payload?.matched || !payload?.placement?.entitySet) return null;
    return {
      action: payload.placement.action || "experience_spatially",
      target: null,
      awareness: payload.placement.action === "experience_spatially"
        ? "I’ll open a governed spatial experience preview for that Joz entity."
        : "I’ll prepare a governed spatial placement preview for your confirmation.",
      placement: payload.placement,
      semanticIntent: {
        source: payload.source,
        confidence: payload.confidence,
        modelRuntime: payload.modelRuntime,
      },
    };
  } catch (error) {
    console.warn("⚠️ Semantic spatial intent unavailable:", error?.message || error);
    return null;
  }
}

export async function resolveVoicePipeline({
  rawInput,
  isMobile,
  currentPortal,
  currentMesh,
  currentMeshStage,
  context,
  detectImmediateMobileCommand,
  resolveLocalVoiceCommand,
  fetchJson,
  apiUrl,
}) {
  const rawLower = String(rawInput || "").trim().toLowerCase();
  const mobileShortcut = isMobile ? detectImmediateMobileCommand(rawLower) : null;
  const spoken = mobileShortcut || rawLower;

  if (!spoken) {
    return {
      rawLower,
      mobileShortcut,
      spoken: "",
      source: null,
      result: null,
      backendMode: null,
    };
  }

  const localResult = resolveLocalVoiceCommand(
    spoken,
    currentPortal,
    currentMesh,
    currentMeshStage
  );

  if (localResult) {
    const enrichedLocalResult = await attachShadowPrediction({
      rawInput: spoken,
      context,
      fetchJson,
      apiUrl,
      localResult,
    });
    return {
      rawLower,
      mobileShortcut,
      spoken,
      source: "local",
      result: enrichedLocalResult,
      backendMode: null,
    };
  }

  const semanticSpatialResult = await resolveBackendSpatialIntent({
    rawInput: spoken,
    context,
    fetchJson,
    apiUrl,
  });
  if (semanticSpatialResult) {
    const enrichedSemanticResult = await attachShadowPrediction({
      rawInput: spoken,
      context,
      fetchJson,
      apiUrl,
      localResult: semanticSpatialResult,
    });
    return {
      rawLower,
      mobileShortcut,
      spoken,
      source: "backend",
      backendMode: "semantic_spatial_intent",
      result: enrichedSemanticResult,
    };
  }

  const agenticResult = await fetchJson(apiUrl("/api/agentic"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: spoken,
      context,
    }),
  });

  const agenticParams = agenticResult?.params || {};
  const hasAgenticAction =
    Boolean(agenticParams.action) ||
    Boolean(agenticParams.target) ||
    Boolean(agenticParams.awareness);

  if (hasAgenticAction) {
    return {
      rawLower,
      mobileShortcut,
      spoken,
      source: "backend",
      backendMode: "agentic",
      result: {
        action: agenticParams.action || null,
        target: agenticParams.target || null,
        awareness: agenticParams.awareness || agenticResult?.response || null,
        source: agenticParams.source || "agentic",
        prediction: agenticResult?.prediction || null,
      },
    };
  }

  const thinkResult = await fetchJson(apiUrl("/api/think"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: spoken,
      currentPortal,
      currentMesh,
      currentMeshStage,
      agentContext: context,
    }),
  });

  return {
    rawLower,
    mobileShortcut,
    spoken,
    source: "backend",
    backendMode: "think_fallback",
    result: {
      action: thinkResult?.action || null,
      target: thinkResult?.target || null,
      awareness: thinkResult?.awareness || null,
      timing: thinkResult?.timing || null,
    },
  };
}
