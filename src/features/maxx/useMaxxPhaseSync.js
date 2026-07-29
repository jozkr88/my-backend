import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";

import { inferMaxxPhaseFromProgress } from "../../world-model/maxx";

export function useMaxxPhaseSync({
  portalId,
  isActive,
  actions,
  paused = false,
  activeFallbackPhase = null,
  pausedPhase = null,
  setCurrentMaxxContext,
}) {
  useEffect(() => {
    if (portalId !== "maxx" || !isActive || !activeFallbackPhase) return;
    setCurrentMaxxContext(activeFallbackPhase);
  }, [activeFallbackPhase, isActive, portalId, setCurrentMaxxContext]);

  useEffect(() => {
    if (portalId !== "maxx" || !isActive || !paused || !pausedPhase) return;
    setCurrentMaxxContext(pausedPhase);
  }, [isActive, paused, pausedPhase, portalId, setCurrentMaxxContext]);

  useFrame(() => {
    if (portalId !== "maxx" || !isActive || paused || !actions) return;

    const activeAction = Object.values(actions).find((action) => action?.getClip?.());
    const duration = activeAction?.getClip?.()?.duration || 0;
    if (!duration || !Number.isFinite(activeAction?.time)) return;

    const progress = (activeAction.time % duration) / duration;
    const phase = inferMaxxPhaseFromProgress(progress);
    setCurrentMaxxContext(phase);
  });
}
