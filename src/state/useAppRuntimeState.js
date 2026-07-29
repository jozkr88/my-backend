import { useEffect, useMemo } from "react";

import { getAllowedActionsForPortal } from "../world-model/meetJoz";
import {
  observeBrowserWorld,
  reconcileBrowserWorldObservations,
} from "../world-model/observeWorld";
import { isWorldModelShadowEnabled } from "../world-model/mode";
import { normalizeAgentMesh } from "../features/voice/context";
import { apiFetch, apiUrl } from "../utils/api";

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

    if (!isWorldModelShadowEnabled()) {
      window.__lastWorldObservation = null;
      return;
    }
    const sceneSnapshot = window.__sceneObservationSnapshot?.sceneState?.activePortal === appState.currentPortal
      ? window.__sceneObservationSnapshot
      : null;
    const currentObservation = observeBrowserWorld({ appState, sceneSnapshot });
    window.__lastWorldObservation = currentObservation;

    const pendingPrediction = window.__lastWorldPrediction;
    const predictedState = pendingPrediction?.selected?.predictedState;
    const predictionPending = pendingPrediction?.pending === true;
    if ((!predictedState && !predictionPending) || pendingPrediction?.observedState) return;

    const observedState = {
      portal: currentPortal,
      stage: currentMeshStage || null,
    };
    const initialState = pendingPrediction.initialState || {};
    const stateChanged =
      observedState.portal !== initialState.portal ||
      observedState.stage !== initialState.stage;

    if (!stateChanged) return;

    const predictedObservation = pendingPrediction.selected?.predictedObservation ||
      pendingPrediction.probabilistic?.selected?.predictedObservation || null;
    const observationComparison = predictedObservation && currentObservation
      ? reconcileBrowserWorldObservations(predictedObservation, currentObservation)
      : null;
    const differences = observationComparison?.differences || [];
    const comparison = observationComparison || {
      matches: differences.length === 0,
      differences,
      errorCount: differences.length,
    };
    window.__lastWorldPrediction = {
      ...pendingPrediction,
      observedState,
      observedObservation: currentObservation,
      observationDifference: observationComparison,
      predictionError: comparison,
      observedAt: new Date().toISOString(),
    };
    const predictedAction = pendingPrediction.selected?.actions?.[0] || null;
    const observedEffects = [];
    if (predictedState?.portal !== observedState.portal) {
      observedEffects.push({ type: "navigate", target: observedState.portal });
    }
    if (predictedState?.stage !== observedState.stage) {
      observedEffects.push({ type: "focus_stage", stage: observedState.stage });
    }
    const createdAtMs = new Date(pendingPrediction.recordedAt || 0).getTime();
    const transitionDurationMs = Number.isFinite(createdAtMs)
      ? Math.max(0, Date.now() - createdAtMs)
      : null;
    void apiFetch(apiUrl("/api/world-model/trajectories"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trajectoryId: pendingPrediction.trajectoryId,
        sessionId: pendingPrediction.sessionId,
        traceId: pendingPrediction.traceId,
        stateBefore: pendingPrediction.initialState,
        proposedAction: predictedAction,
        symbolicPrediction: pendingPrediction.selected,
        probabilisticPrediction: pendingPrediction.probabilistic?.selected || null,
        plannerSelectedAction: pendingPrediction.plannerSelected?.actions?.[0] || null,
        deterministicApprovedAction: pendingPrediction.approvedAction || null,
        candidatePlans: pendingPrediction.candidates || [],
        observationBefore: pendingPrediction.observationBefore || null,
        predictedObservation,
        observedObservation: currentObservation,
        observationDifference: observationComparison,
        observationSourceVersions: currentObservation?.sourceVersions || {},
        expectedEffects: pendingPrediction.selected?.expectedEffects || [],
        observedState: currentObservation?.symbolicState || observedState,
        observedEffects,
        intent: "spatial_navigation",
        goal: pendingPrediction.goal || "world_navigation",
        interactionChannel: pendingPrediction.interactionChannel || "voice",
        transitionDurationMs,
        success: comparison.success !== false,
        predictionDifferences: comparison,
        confidenceBeforeAction: pendingPrediction.selected?.confidence,
        outcomeScores: pendingPrediction.probabilistic?.selected?.score || pendingPrediction.selected?.score || {},
        modelVersion: pendingPrediction.modelVersion,
        transitionRuleVersion: pendingPrediction.transitionRuleVersion,
        shadowLatencyMs: pendingPrediction.shadowLatencyMs,
        predictionLatencyMs: pendingPrediction.shadowLatencyMs,
        fieldSupport: currentObservation?.fieldSupport || {},
        sampled: pendingPrediction.sampled !== false,
        createdAt: pendingPrediction.recordedAt,
        observedAt: new Date().toISOString(),
      }),
    }).catch((error) => {
      console.warn("⚠️ World-model trajectory recording failed:", error?.message || error);
    });
    window.dispatchEvent(
      new CustomEvent("world-prediction-observed", {
        detail: window.__lastWorldPrediction,
      })
    );
  }, [appState]);

  return appState;
}
