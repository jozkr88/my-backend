import { useEffect } from "react";

import { Environment } from "@react-three/drei";
import { useThree } from "@react-three/fiber";

import { useARSupport } from "../../hooks/useARSupport";
import { assetUrl } from "../../utils/paths";

export function World2() {
  const { isMobile } = useARSupport();
  const { scene } = useThree();

  useEffect(() => {
    if ("backgroundIntensity" in scene) {
      const prev = scene.backgroundIntensity ?? 1;
      scene.backgroundIntensity = 0.3;
      return () => {
        scene.backgroundIntensity = prev;
      };
    }
    return undefined;
  }, [scene]);

  const textureFiles = (
    isMobile
      ? ["/nx1-m.webp", "/px1-m.webp", "/py1-m.webp", "/ny1-m.webp", "/nz1-m.webp", "/pz1-m.webp"]
      : ["/nx1.webp", "/px1.webp", "/py1.webp", "/ny1.webp", "/nz1.webp", "/pz1.webp"]
  ).map(assetUrl);

  return <Environment background files={textureFiles} />;
}
