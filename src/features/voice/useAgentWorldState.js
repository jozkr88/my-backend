import { useEffect } from "react";

import {
  CURRENT_MESH_EVENT,
  MAXX_PHASE_EVENT,
  setCurrentMeshContext,
} from "../../world-model/runtimeContext";

export function useAgentWorldState({
  currentPortal,
  setAgentCurrentMesh,
  setAgentCurrentMeshStage,
  setAgentCurrentPhase,
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (currentPortal === "maxx" || currentPortal === "the-vibe-energy") {
      if (
        ["vibe", "discover", "skills"].includes(
          String(window.__currentMesh || "").toLowerCase()
        )
      ) {
        setCurrentMeshContext(null);
        setAgentCurrentMesh(null);
      }
      return;
    }

    if (
      currentPortal !== "meet-joz" &&
      currentPortal !== "maxx" &&
      currentPortal !== "the-vibe-energy"
    ) {
      if (
        [
          "brain_entry",
          "signal_flow",
          "new_pathways",
          "memory_building",
          "inside_the_brain",
        ].includes(String(window.__currentMesh || "").toLowerCase())
      ) {
        setCurrentMeshContext(null);
        setAgentCurrentMesh(null);
      }
      window.__maxxPhase = null;
      setAgentCurrentPhase(null);
    }
  }, [currentPortal, setAgentCurrentMesh, setAgentCurrentPhase]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncCurrentMesh = (event) => {
      const nextMesh = event?.detail?.mesh ?? window.__currentMesh ?? null;
      const nextStage = event?.detail?.stage ?? window.__currentMeshStage ?? null;
      setAgentCurrentMesh((current) => (current === nextMesh ? current : nextMesh));
      setAgentCurrentMeshStage((current) =>
        current === nextStage ? current : nextStage
      );
    };

    syncCurrentMesh();
    window.addEventListener(CURRENT_MESH_EVENT, syncCurrentMesh);
    return () => window.removeEventListener(CURRENT_MESH_EVENT, syncCurrentMesh);
  }, [setAgentCurrentMesh, setAgentCurrentMeshStage]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncCurrentPhase = (event) => {
      const nextPhase = event?.detail?.phase ?? window.__maxxPhase ?? null;
      setAgentCurrentPhase((current) =>
        current === nextPhase ? current : nextPhase
      );
    };

    syncCurrentPhase();
    window.addEventListener(MAXX_PHASE_EVENT, syncCurrentPhase);
    return () => window.removeEventListener(MAXX_PHASE_EVENT, syncCurrentPhase);
  }, [setAgentCurrentPhase]);
}
