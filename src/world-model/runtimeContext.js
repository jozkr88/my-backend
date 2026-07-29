export const CURRENT_MESH_EVENT = "neo-current-mesh-change";
export const MAXX_PHASE_EVENT = "neo-maxx-phase-change";

export function setCurrentMeshContext(nextMesh, options = {}) {
  if (typeof window === "undefined") return;
  const normalizedMesh = nextMesh ? String(nextMesh).toLowerCase() : null;
  const normalizedStage = options?.stage ? String(options.stage).toLowerCase() : null;

  if (
    window.__currentMesh === normalizedMesh &&
    (window.__currentMeshStage || null) === normalizedStage
  ) {
    return;
  }

  window.__currentMesh = normalizedMesh;
  window.__currentMeshStage = normalizedStage;
  window.dispatchEvent(
    new CustomEvent(CURRENT_MESH_EVENT, {
      detail: { mesh: normalizedMesh, stage: normalizedStage },
    })
  );
}

export function setCurrentMaxxPhase(nextPhase) {
  if (typeof window === "undefined") return;
  const normalizedPhase = nextPhase ? String(nextPhase).toLowerCase() : null;
  if (window.__maxxPhase === normalizedPhase) return;

  window.__maxxPhase = normalizedPhase;
  window.dispatchEvent(
    new CustomEvent(MAXX_PHASE_EVENT, {
      detail: { phase: normalizedPhase },
    })
  );
}

export function setCurrentMaxxContext(nextPhase) {
  setCurrentMaxxPhase(nextPhase);
  setCurrentMeshContext(nextPhase);
}
