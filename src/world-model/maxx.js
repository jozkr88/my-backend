import * as THREE from "three";

export function inferMaxxPhaseFromProgress(progress) {
  const normalized = Number.isFinite(progress)
    ? THREE.MathUtils.clamp(progress, 0, 1)
    : 0;

  if (normalized < 0.14) return "brain_entry";
  if (normalized < 0.45) return "signal_flow";
  if (normalized < 0.72) return "new_pathways";
  return "memory_building";
}
