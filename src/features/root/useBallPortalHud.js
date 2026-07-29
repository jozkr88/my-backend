import * as THREE from "three";
import { useEffect, useRef, useState } from "react";

const BALL_PORTAL_NAV_DELAY_MS = 180;

export function useBallPortalHud({
  currentPortal,
  announcePortalTransition,
  setLocation,
}) {
  const [ballPortalEntering, setBallPortalEntering] = useState(
    currentPortal !== "root"
  );
  const [rootBallHudVisible, setRootBallHudVisible] = useState(
    currentPortal === "root"
  );
  const shouldMountBallHud = rootBallHudVisible || ballPortalEntering;
  const shouldShowBallHud =
    currentPortal === "root" && rootBallHudVisible && !ballPortalEntering;
  const ballOpacityTargetRef = useRef(shouldShowBallHud ? 1 : 0);
  const ballPortalNavTimeoutRef = useRef(null);
  const ballHudReturnTimeoutRef = useRef(null);
  const ballFadeRafRef = useRef(null);

  useEffect(() => {
    if (currentPortal !== "root" && ballPortalEntering) {
      setBallPortalEntering(false);
    }
  }, [ballPortalEntering, currentPortal]);

  useEffect(() => {
    if (ballHudReturnTimeoutRef.current) {
      window.clearTimeout(ballHudReturnTimeoutRef.current);
      ballHudReturnTimeoutRef.current = null;
    }

    if (currentPortal === "root") {
      ballHudReturnTimeoutRef.current = window.setTimeout(() => {
        setRootBallHudVisible(true);
        ballHudReturnTimeoutRef.current = null;
      }, 0);
    } else {
      setRootBallHudVisible(false);
    }

    return () => {
      if (ballHudReturnTimeoutRef.current) {
        window.clearTimeout(ballHudReturnTimeoutRef.current);
        ballHudReturnTimeoutRef.current = null;
      }
    };
  }, [currentPortal]);

  useEffect(() => {
    const startOpacity = ballOpacityTargetRef.current;
    const endOpacity = shouldShowBallHud ? 1 : 0;
    const durationMs = shouldShowBallHud ? 180 : 420;
    const startTime = performance.now();

    if (ballFadeRafRef.current) {
      window.cancelAnimationFrame(ballFadeRafRef.current);
    }

    const step = (now) => {
      const t = Math.min((now - startTime) / durationMs, 1);
      const eased = t * t * (3 - 2 * t);
      ballOpacityTargetRef.current = THREE.MathUtils.lerp(
        startOpacity,
        endOpacity,
        eased
      );

      if (t < 1) {
        ballFadeRafRef.current = window.requestAnimationFrame(step);
      } else {
        ballOpacityTargetRef.current = endOpacity;
        ballFadeRafRef.current = null;
      }
    };

    ballFadeRafRef.current = window.requestAnimationFrame(step);

    return () => {
      if (ballFadeRafRef.current) {
        window.cancelAnimationFrame(ballFadeRafRef.current);
        ballFadeRafRef.current = null;
      }
    };
  }, [shouldShowBallHud]);

  useEffect(() => {
    return () => {
      if (ballPortalNavTimeoutRef.current) {
        window.clearTimeout(ballPortalNavTimeoutRef.current);
      }
      if (ballHudReturnTimeoutRef.current) {
        window.clearTimeout(ballHudReturnTimeoutRef.current);
      }
      if (ballFadeRafRef.current) {
        window.cancelAnimationFrame(ballFadeRafRef.current);
      }
    };
  }, []);

  const handleBallPortalOpen = () => {
    if (currentPortal !== "root" || ballPortalEntering) {
      return;
    }

    setBallPortalEntering(true);
    announcePortalTransition("/neo/meet-joz");

    if (ballPortalNavTimeoutRef.current) {
      window.clearTimeout(ballPortalNavTimeoutRef.current);
    }

    ballPortalNavTimeoutRef.current = window.setTimeout(() => {
      ballPortalNavTimeoutRef.current = null;
      setLocation("/neo/meet-joz");
    }, BALL_PORTAL_NAV_DELAY_MS);
  };

  return {
    shouldMountBallHud,
    ballOpacityTargetRef,
    handleBallPortalOpen,
  };
}
