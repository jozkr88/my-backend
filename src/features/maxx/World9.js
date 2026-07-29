import { useEffect } from "react";

import { Environment } from "@react-three/drei";
import { useThree } from "@react-three/fiber";

import { useARSupport } from "../../hooks/useARSupport";
import { assetUrl } from "../../utils/paths";

export function World9() {
  const { isMobile } = useARSupport();
  const { scene } = useThree();

  useEffect(() => {
    if ("backgroundIntensity" in scene) {
      const prev = scene.backgroundIntensity ?? 1;
      scene.backgroundIntensity = 1;
      return () => {
        scene.backgroundIntensity = prev;
      };
    }
    return undefined;
  }, [scene]);

  const textureFiles = (
    isMobile
      ? ["/nxp-m.webp", "/pxp-m.webp", "/pyp-m.webp", "/nyp-m.webp", "/nzp-m.webp", "/pzp-m.webp"]
      : ["/nxp.webp", "/pxp.webp", "/pyp.webp", "/nyp.webp", "/nzp.webp", "/pzp.webp"]
  ).map(assetUrl);

  return (
    <Environment
      background
      files={textureFiles}
      backgroundIntensity={0.2}
      environmentIntensity={0.7}
    />
  );
}
