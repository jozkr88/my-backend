import { getAllowedActionsForPortal, getMeetJozVoiceLayer } from "../../world-model/meetJoz";
import { isWorldModelShadowEnabled } from "../../world-model/mode";

function getKnownInteractiveMeshes(currentPortal) {
  if (currentPortal === "root") {
    return ["brain", "ball"];
  }

  if (currentPortal === "meet-joz") {
    return [
      "vibe",
      "discover",
      "skills",
      "worldx_desktop",
      "golden_environment_mobile",
      "capsule",
      "heart",
      "clout_maxx",
      "scale_maxx",
      "alpha_psl",
      "world_class",
      "atmos_maxx",
      "cross_sensory_aura_engineering",
      "maximize_beauty_change_reality",
      "ai_synthesis",
      "ai_analysis",
      "signature",
    ];
  }

  if (currentPortal === "the-vibe-energy" || currentPortal === "maxx") {
    return [
      "neurotransmitters",
      "inside_the_brain",
      "human neuron",
      "ai neuron",
      "spatial capability",
      "elite beauty",
      "ascension",
      "frame mogg",
      "new pathways",
    ];
  }

  return [];
}

export function normalizeAgentMesh({ currentPortal, currentMesh, currentMeshStage }) {
  if (currentPortal === "meet-joz") {
    return getMeetJozVoiceLayer(currentMesh, currentMeshStage);
  }

  return String(currentMesh || "").toLowerCase() || null;
}

export function buildAgentContext({
  appState,
  currentPortal,
  currentMesh,
  currentMeshStage,
  currentPath = "/",
  showContactButtons,
  micEnabled,
  effectiveListening,
  micError,
  isHelpOpen,
  ar,
  isMobile,
  effectiveTranscript,
  suggestionText,
  currentPhase,
}) {
  if (appState) {
    return {
      appPurpose:
        "3D portfolio world with portal navigation, animated meshes, AR triggers, and voice-driven state transitions.",
      ...appState,
      worldObservation:
        typeof window !== "undefined" && isWorldModelShadowEnabled()
          ? window.__lastWorldObservation || null
          : null,
    };
  }

  const normalizedMesh = normalizeAgentMesh({
    currentPortal,
    currentMesh,
    currentMeshStage,
  });

  return {
    appPurpose:
      "3D portfolio world with portal navigation, animated meshes, AR triggers, and voice-driven state transitions.",
    currentPortal,
    currentMesh: normalizedMesh,
    currentMeshStage: currentMeshStage || null,
    currentPath,
    uiState: {
      contactButtonsVisible: showContactButtons,
      micEnabled,
      listening: effectiveListening,
      micError: micError || null,
      helpOpen: isHelpOpen,
      arSupported: Boolean(ar),
      isMobile,
    },
    voiceState: {
      effectiveTranscript: effectiveTranscript || "",
      suggestionText: suggestionText || "",
      currentPhase: currentPhase || "",
    },
    allowedActions: getAllowedActionsForPortal(
      currentPortal,
      normalizedMesh,
      currentMeshStage
    ),
    knownInteractiveMeshes: getKnownInteractiveMeshes(currentPortal),
  };
}

export function buildVoiceTestContext({
  overrides = {},
  agentContext,
  currentPortal,
  isMobile,
  windowCurrentMesh,
  windowCurrentMeshStage,
}) {
  const nextPortal =
    String(overrides.currentPortal || overrides.portal || currentPortal || "root").trim() ||
    "root";
  const nextStage =
    String(
      overrides.currentMeshStage ||
        overrides.stage ||
        windowCurrentMeshStage ||
        agentContext?.currentMeshStage ||
        ""
    )
      .toLowerCase()
      .trim() || null;
  const nextMeshRaw =
    String(
      overrides.currentMesh ||
        overrides.mesh ||
        windowCurrentMesh ||
        agentContext?.currentMesh ||
        ""
    )
      .toLowerCase()
      .trim() || null;
  const nextMesh = normalizeAgentMesh({
    currentPortal: nextPortal,
    currentMesh: nextMeshRaw,
    currentMeshStage: nextStage,
  });
  const nextIsMobile =
    typeof overrides.isMobile === "boolean" ? overrides.isMobile : isMobile;
  const nextPath =
    typeof overrides.currentPath === "string" && overrides.currentPath.trim()
      ? overrides.currentPath.trim()
      : nextPortal === "root"
        ? "/"
        : nextPortal === "maxx" || nextPortal === "the-vibe-energy"
          ? "/neo/maxx"
          : `/neo/${nextPortal}`;

  return {
    ...agentContext,
    currentPortal: nextPortal,
    currentMesh: nextMesh,
    currentMeshStage: nextStage,
    currentPath: nextPath,
    uiState: {
      ...(agentContext?.uiState || {}),
      isMobile: nextIsMobile,
    },
    voiceState: {
      ...(agentContext?.voiceState || {}),
      effectiveTranscript: String(overrides.effectiveTranscript || "").trim(),
    },
    allowedActions: getAllowedActionsForPortal(nextPortal, nextMesh, nextStage),
  };
}
