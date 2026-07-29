import { useEffect } from "react";

import { useGLTF } from "@react-three/drei";

export function usePortalModelPreload({
  currentPortal,
  isMobile,
  rootWarmupModels,
  portalPreloadModels,
  desktopOnlyModels,
}) {
  useEffect(() => {
    rootWarmupModels.forEach((path) => useGLTF.preload(path));
  }, [rootWarmupModels]);

  useEffect(() => {
    const models = portalPreloadModels[currentPortal] || [];
    models.forEach((path) => useGLTF.preload(path));

    if (!isMobile && currentPortal === "meet-joz") {
      desktopOnlyModels.forEach((path) => useGLTF.preload(path));
    }
  }, [currentPortal, desktopOnlyModels, isMobile, portalPreloadModels]);
}
