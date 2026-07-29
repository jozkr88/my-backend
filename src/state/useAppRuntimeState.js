import { useEffect, useMemo } from "react";

import { getAllowedActionsForPortal } from "../world-model/meetJoz";
import { normalizeAgentMesh } from "../features/voice/context";

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

export function useAppRuntimeState({
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
  const appState = useMemo(() => {
    const normalizedMesh = normalizeAgentMesh({
      currentPortal,
      currentMesh,
      currentMeshStage,
    });

    return {
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
  }, [
    ar,
    currentMesh,
    currentMeshStage,
    currentPath,
    currentPhase,
    currentPortal,
    effectiveListening,
    effectiveTranscript,
    isHelpOpen,
    isMobile,
    micEnabled,
    micError,
    showContactButtons,
    suggestionText,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__appState = appState;
  }, [appState]);

  return appState;
}
