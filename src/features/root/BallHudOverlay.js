import * as THREE from "three";

import { useMemo } from "react";
import { Environment, Hud, OrthographicCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";

import { useARSupport } from "../../hooks/useARSupport";
import { getMeetJozEnvironmentFiles } from "../meet-joz/World8";

export function BallHudOverlay({
  BallComponent,
  opacityTarget = 1,
  opacityTargetRef = null,
  onLoad,
  onActivate,
}) {
  const { isMobile } = useARSupport();
  const { size } = useThree();
  const environmentFiles = useMemo(
    () => getMeetJozEnvironmentFiles(isMobile),
    [isMobile]
  );
  const HUD_ZOOM = 150;
  const ballPosition = useMemo(() => {
    const halfHudHeight = size.height / (HUD_ZOOM * 2);

    if (isMobile) {
      return [0, -halfHudHeight + 44 / HUD_ZOOM, 0];
    }

    if (size.height <= 600) {
      return [0, -halfHudHeight - 4 / HUD_ZOOM, 0];
    }
    return [0, -halfHudHeight + 50 / HUD_ZOOM, 0];
  }, [isMobile, size.height]);
  const ballScale = useMemo(() => {
    const baseScale = isMobile ? 1.3 : 1.72;
    const baselineHeight = isMobile ? 860 : 980;
    const minFactor = isMobile ? 0.66 : 0.74;
    const heightFactor = THREE.MathUtils.clamp(
      size.height / baselineHeight,
      minFactor,
      1
    );
    return baseScale * heightFactor;
  }, [isMobile, size.height]);

  return (
    <Hud>
      <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={HUD_ZOOM} />
      <Environment files={environmentFiles} environmentIntensity={1} />
      <ambientLight intensity={5} />
      <BallComponent
        position={ballPosition}
        scale={ballScale}
        opacityTarget={opacityTarget}
        opacityTargetRef={opacityTargetRef}
        onLoad={onLoad}
        onActivate={onActivate}
      />
    </Hud>
  );
}
