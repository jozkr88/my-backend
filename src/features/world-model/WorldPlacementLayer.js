import { useEffect, useState } from "react";

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
  const [pendingPlan, setPendingPlan] = useState(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const handleRequest = (event) => {
      const plan = planWorldPlacement({
        request: event.detail,
        sceneSnapshot: window.__sceneObservationSnapshot,
      });
      if (!plan) {
        setStatus("Ask about a specific Joz skill, work, or neuron first, then say ‘experience spatially’. ");
        return;
      }
      window.__lastWorldPlacementPlan = plan;
      setStatus("");
      setPendingPlan(plan);
    };

    window.addEventListener("world-placement-requested", handleRequest);
    return () => window.removeEventListener("world-placement-requested", handleRequest);
  }, []);

  const commit = async () => {
    if (!pendingPlan) return;
    const before = currentState();
    const observedState = buildPlacementObservedState({
      plan: pendingPlan,
      previousState: before,
    });
    const action = {
      type: "place_entity_set",
      entitySet: pendingPlan.entitySet,
      targetMode: pendingPlan.targetMode,
      anchorId: pendingPlan.anchorId,
      layout: pendingPlan.layout,
    };
    const effects = [{
      type: "place_entity_set",
      entitySet: pendingPlan.entitySet,
      targetMode: pendingPlan.targetMode,
      instanceIds: pendingPlan.instances.map((instance) => instance.instanceId),
    }];

    setPendingPlan(null);
    setStatus("Placed in the governed world state.");
    window.__worldPlacementState = {
      revision: observedState.worldRevision,
      ...observedState.placement,
      instances: pendingPlan.instances,
    };
    try {
      window.localStorage.setItem(
        "joz.world.placement.v1",
        JSON.stringify({ plan: pendingPlan, observedState })
      );
    } catch {
      // Browser storage is an optional local cache; database telemetry remains authoritative.
    }
    window.dispatchEvent(new CustomEvent("world-placement-committed", {
      detail: { plan: pendingPlan, observedState },
    }));

    try {
      const recorded = await fetchJson(apiUrl("/api/world-model/trajectories"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trajectoryId: `placement-${pendingPlan.placementId}-${Date.now()}`,
          traceId: `placement-${pendingPlan.placementId}`,
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
      setStatus(`Placed ${pendingPlan.instances.length} entities · ${recorded?.mode || "recorded"}`);
    } catch (error) {
      setStatus("Placed locally; trajectory recording is unavailable.");
      console.warn("⚠️ World placement trajectory recording failed:", error?.message || error);
    }
  };

  const cancel = () => {
    setPendingPlan(null);
    setStatus("Placement cancelled.");
  };

  return (
    <>
      {pendingPlan ? (
        <section className="world-placement-preview" aria-live="polite">
          <div className="world-placement-kicker">GOVERNED WORLD ACTION</div>
          <h2>{pendingPlan.entityLabel}</h2>
          <p>
            {pendingPlan.instances.length} entities · {pendingPlan.executionMode === "virtual_world_fallback"
              ? "virtual preview (AR anchor unavailable)"
              : pendingPlan.targetMode === "ar" ? "AR space" : "virtual world"} · {pendingPlan.layout} layout
          </p>
          <div className="world-placement-entities">
            {pendingPlan.instances.map((instance) => (
              <span key={instance.instanceId}>{instance.label}</span>
            ))}
          </div>
          <div className="world-placement-actions">
            <button type="button" onClick={commit}>Confirm placement</button>
            <button type="button" className="world-placement-cancel" onClick={cancel}>Cancel</button>
          </div>
        </section>
      ) : null}

      {status ? <div className="world-placement-status">{status}</div> : null}
    </>
  );
}
