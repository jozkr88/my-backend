import { useEffect } from "react";

import { apiUrl, fetchJson } from "../../utils/api";
import {
  buildPlacementObservedState,
  planWorldPlacement,
} from "../../world-model/placement";

function currentState() {
  return window.__lastWorldObservation?.symbolicState || {
    portal: window.__appState?.currentPortal || "root",
    currentStateKey: window.__appState?.currentMesh || window.__appState?.currentPortal || "root",
    focusedEntityId: window.__appState?.currentMesh || null,
  };
}

export function WorldPlacementLayer() {
  useEffect(() => {
    const commit = async (plan) => {
      const before = currentState();
      const observedState = buildPlacementObservedState({
        plan,
        previousState: before,
      });
      const action = {
        type: "place_entity_set",
        entitySet: plan.entitySet,
        targetMode: plan.targetMode,
        anchorId: plan.anchorId,
        layout: plan.layout,
      };
      const effects = [{
        type: "place_entity_set",
        entitySet: plan.entitySet,
        targetMode: plan.targetMode,
        instanceIds: plan.instances.map((instance) => instance.instanceId),
      }];

      window.__worldPlacementState = {
        revision: observedState.worldRevision,
        ...observedState.placement,
        instances: plan.instances,
      };
      try {
        window.localStorage.setItem(
          "joz.world.placement.v1",
          JSON.stringify({ plan, observedState })
        );
      } catch {
        // Browser storage is an optional local cache; database telemetry remains authoritative.
      }
      window.dispatchEvent(new CustomEvent("world-placement-committed", {
        detail: { plan, observedState },
      }));

      try {
        const recorded = await fetchJson(apiUrl("/api/world-model/trajectories"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trajectoryId: `placement-${plan.placementId}-${Date.now()}`,
            traceId: `placement-${plan.placementId}`,
            stateBefore: before,
            proposedAction: action,
            symbolicPrediction: {
              actions: [action],
              predictedState: observedState,
              expectedEffects: effects,
              confidence: 0.95,
              score: { total: 0.95, risk: 0 },
            },
            expectedEffects: effects,
            observedState,
            observedEffects: effects,
            observationDifference: {
              matches: true,
              differences: [],
              metrics: { mismatchCount: 0, criticalMismatchCount: 0 },
            },
            intent: "spatial_placement",
            goal: "place_entity_set",
            interactionChannel: "voice_or_text",
            success: true,
            modelVersion: "placement-symbolic-v1",
            transitionRuleVersion: "placement-rules-v1",
            sampled: true,
            observedAt: new Date().toISOString(),
          }),
        });
        console.log("🌐 World placement trajectory recorded:", recorded);
      } catch (error) {
        console.warn("⚠️ World placement trajectory recording failed:", error?.message || error);
      }
    };

    const handleRequest = (event) => {
      const plan = planWorldPlacement({
        request: event.detail,
        sceneSnapshot: window.__sceneObservationSnapshot,
      });
      if (!plan) {
        console.warn("⚠️ World placement request ignored: no valid plan.");
        return;
      }
      window.__lastWorldPlacementPlan = plan;
      void commit(plan);
    };

    window.addEventListener("world-placement-requested", handleRequest);
    return () => window.removeEventListener("world-placement-requested", handleRequest);
  }, []);

  return null;
}
