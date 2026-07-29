import * as THREE from "three";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Environment } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";

import { useARSupport } from "../../hooks/useARSupport";
import { assetUrl } from "../../utils/paths";

export function getMeetJozEnvironmentFiles(isMobile) {
  return (
    isMobile
      ? [
          "/nx8-m.webp",
          "/px8-m.webp",
          "/py8-m.webp",
          "/ny8-m.webp",
          "/nz8-m.webp",
          "/pz8-m.webp",
        ]
      : ["/nx8.webp", "/px8.webp", "/py8.webp", "/ny8.webp", "/nz8.webp", "/pz8.webp"]
  ).map(assetUrl);
}

export const World8 = ({
  fadeIn = false,
  inDuration = 0.5,
  outDuration = 0.5,
  inDelay = 0,
  outDelay = 0,
  target = 0.8,
  forcedOpacity = null,
  showBackground = true,
  onReadableBackdropChange,
}) => {
  const { isMobile } = useARSupport();
  const { scene, gl } = useThree();
  const [backgroundMounted, setBackgroundMounted] = useState(showBackground);

  const pNormRef = useRef(0);
  const waitRef = useRef(0);
  const goalRef = useRef(0);

  const hasBI = "backgroundIntensity" in scene;
  const prevIntensityRef = useRef(1);
  const baseExposureRef = useRef(gl.toneMappingExposure);
  const lastShowBackgroundRef = useRef(showBackground);
  const unmountTimeoutRef = useRef(null);
  const readableBackdropRef = useRef(false);

  useLayoutEffect(() => {
    if (!backgroundMounted) {
      return undefined;
    }

    if (hasBI) {
      prevIntensityRef.current = scene.backgroundIntensity ?? 1;
      scene.backgroundIntensity = 0;
    } else {
      baseExposureRef.current = gl.toneMappingExposure;
      gl.toneMappingExposure = 0;
    }
    pNormRef.current = 0;

    return () => {
      if (hasBI) {
        scene.backgroundIntensity = prevIntensityRef.current;
      } else {
        gl.toneMappingExposure = baseExposureRef.current;
      }
      if (readableBackdropRef.current) {
        readableBackdropRef.current = false;
        onReadableBackdropChange?.(false);
      }
    };
  }, [backgroundMounted, gl, hasBI, onReadableBackdropChange, scene]);

  useEffect(() => {
    if (!backgroundMounted) {
      return undefined;
    }

    if (forcedOpacity !== null) {
      goalRef.current = forcedOpacity;
      waitRef.current = 0;
    } else {
      goalRef.current = fadeIn ? 1 : 0;
      waitRef.current = fadeIn ? inDelay : outDelay;
    }
  }, [backgroundMounted, fadeIn, forcedOpacity, inDelay, outDelay]);

  useEffect(() => {
    const wasShowing = lastShowBackgroundRef.current;
    lastShowBackgroundRef.current = showBackground;

    if (unmountTimeoutRef.current) {
      window.clearTimeout(unmountTimeoutRef.current);
      unmountTimeoutRef.current = null;
    }

    if (showBackground && !wasShowing) {
      if (!backgroundMounted) {
        setBackgroundMounted(true);
      }
      pNormRef.current = 0;
      waitRef.current = forcedOpacity !== null ? 0 : fadeIn ? inDelay : 0;
      goalRef.current = forcedOpacity !== null ? forcedOpacity : fadeIn ? 1 : 0;

      if (hasBI) {
        scene.backgroundIntensity = 0;
      } else {
        gl.toneMappingExposure = 0;
      }
      if (readableBackdropRef.current) {
        readableBackdropRef.current = false;
        onReadableBackdropChange?.(false);
      }
      return;
    }

    if (!showBackground && wasShowing) {
      waitRef.current = outDelay;
      goalRef.current = 0;
      if (readableBackdropRef.current) {
        readableBackdropRef.current = false;
        onReadableBackdropChange?.(false);
      }
      if (backgroundMounted) {
        unmountTimeoutRef.current = window.setTimeout(() => {
          setBackgroundMounted(false);
          unmountTimeoutRef.current = null;
        }, Math.max(0, (outDelay + outDuration) * 1000 + 40));
      }
    }
    return () => {
      if (unmountTimeoutRef.current) {
        window.clearTimeout(unmountTimeoutRef.current);
        unmountTimeoutRef.current = null;
      }
    };
  }, [
    backgroundMounted,
    fadeIn,
    forcedOpacity,
    gl,
    hasBI,
    inDelay,
    onReadableBackdropChange,
    outDelay,
    outDuration,
    scene,
    showBackground,
  ]);

  useFrame((_, dt) => {
    if (!backgroundMounted) return;

    if (waitRef.current > 0) {
      waitRef.current -= dt;
    }

    const tNorm = goalRef.current;
    let p = pNormRef.current;
    const dur = tNorm >= p ? inDuration : outDuration;

    if (waitRef.current <= 0 && Math.abs(p - tNorm) >= 1e-4) {
      const dir = Math.sign(tNorm - p);
      p = THREE.MathUtils.clamp(p + (dt / Math.max(dur, 1e-4)) * dir, 0, 1);
      pNormRef.current = p;
    }

    const eased = p * p * (3 - 2 * p);
    const readableBackdrop = showBackground && eased >= 0.34;

    if (readableBackdropRef.current !== readableBackdrop) {
      readableBackdropRef.current = readableBackdrop;
      onReadableBackdropChange?.(readableBackdrop);
    }

    if (hasBI) {
      scene.backgroundIntensity = target * eased;
    } else {
      gl.toneMappingExposure = THREE.MathUtils.lerp(
        0,
        baseExposureRef.current * target,
        eased
      );
    }
  });

  const files = getMeetJozEnvironmentFiles(isMobile);

  return (
    <Environment
      background={backgroundMounted}
      files={files}
      environmentIntensity={1}
    />
  );
};

export const World8m = ({
  fadeIn = false,
  inDuration = 2,
  outDuration = 0.8,
  inDelay = 1.6,
  outDelay = 0,
  forcedOpacity = null,
  showBackground = true,
  onReadableBackdropChange,
}) => {
  return (
    <World8
      fadeIn={fadeIn}
      inDuration={inDuration}
      outDuration={outDuration}
      inDelay={inDelay}
      outDelay={outDelay}
      forcedOpacity={forcedOpacity}
      showBackground={showBackground}
      onReadableBackdropChange={onReadableBackdropChange}
    />
  );
};
