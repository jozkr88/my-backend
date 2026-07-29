import * as THREE from "three";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";

import { SkeletonUtils } from "three-stdlib";

import { assetUrl } from "../../utils/paths";

export function FadableModel3({
  url = "/aurx.glb",
  position = [0, -0.7, -2],
  scale = [0.9, 0.9, 0.9],
  isVisible = false,
  duration = 0.8,
  outDuration = null,
  inDelay = 0,
  outDelay = 0,
  playbackDelay = 0,
  mode = "fadeOnly",
  trigger = 0,
  playbackRange = null,
  fps = 24,
}) {
  const group = useRef();
  const { scene: src, animations } = useGLTF(assetUrl(url));
  const scene = useMemo(() => (src ? SkeletonUtils.clone(src) : null), [src]);
  const { actions, mixer } = useAnimations(animations, group);

  const matsRef = useRef([]);
  const progressRef = useRef(0);
  const opacityRef = useRef(0);
  const targetRef = useRef(isVisible ? 1 : 0);
  const didConfigureActionsRef = useRef(false);
  const mixerRef = useRef(null);
  const lastPlaybackKeyRef = useRef(null);

  const pendingRef = useRef(false);
  const delayLeftRef = useRef(0);
  const lastVisibleRef = useRef(isVisible);
  const playbackTimeoutRef = useRef(null);

  useEffect(() => {
    mixerRef.current = mixer;
  }, [mixer]);

  useLayoutEffect(() => {
    if (!scene) return;
    matsRef.current = [];
    scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const makeMat = (mat) => {
        const next = mat.clone();
        next.transparent = true;
        next.opacity = 0;
        next.depthWrite = false;
        return next;
      };
      if (Array.isArray(o.material)) {
        o.material = o.material.map(makeMat);
        matsRef.current.push(...o.material);
      } else {
        o.material = makeMat(o.material);
        matsRef.current.push(o.material);
      }
      o.onBeforeRender = () => {
        if (Array.isArray(o.material)) {
          o.material.forEach((m) => {
            m.opacity = opacityRef.current;
          });
        } else {
          o.material.opacity = opacityRef.current;
        }
      };
    });
  }, [scene]);

  useEffect(() => {
    if (!actions || didConfigureActionsRef.current) return;
    Object.values(actions).forEach((a) => {
      if (!a) return;
      a.reset();
      a.clampWhenFinished = true;
      a.setLoop(THREE.LoopOnce, 0);
      a.paused = true;
    });
    didConfigureActionsRef.current = true;
  }, [actions]);

  useEffect(() => {
    return () => mixerRef.current?.stopAllAction();
  }, []);

  useEffect(() => {
    return () => {
      if (playbackTimeoutRef.current) {
        window.clearTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!actions || mode === "fadeOnly") return;
    const action = Object.values(actions)[0];
    if (!action) return;
    const playbackKey = `${mode}:${trigger}:${
      playbackRange ? playbackRange.join("-") : "none"
    }:${fps}`;
    if (lastPlaybackKeyRef.current === playbackKey) return;
    lastPlaybackKeyRef.current = playbackKey;

    if (playbackTimeoutRef.current) {
      window.clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }

    if (mode === "playBackward" && playbackDelay > 0) {
      const durationSec = action.getClip().duration;
      action.reset();
      action.time = durationSec;
      action.timeScale = 0;
      action.paused = true;
      mixer.update(0);
    }

    if (mode === "playRange" && playbackRange && playbackDelay > 0) {
      const [startF] = playbackRange;
      const startSec = startF / fps;
      action.reset();
      action.time = startSec;
      action.timeScale = 0;
      action.paused = true;
      mixer.update(0);
    }

    const startPlayback = () => {
      if (mode === "playForward") {
        action.reset();
        action.timeScale = 1;
        action.paused = false;
        action.play();
      }

      if (mode === "playBackward") {
        const durationSec = action.getClip().duration;
        action.time = durationSec;
        action.timeScale = -1;
        action.paused = false;
        action.play();
      }

      if (mode === "playRange" && playbackRange) {
        const [startF, endF] = playbackRange;
        const startSec = startF / fps;
        const endSec = endF / fps;

        action.reset();
        action.time = startSec;
        action.timeScale = -1;
        action.paused = false;
        action.play();

        const check = () => {
          if (action.time <= endSec) {
            action.paused = true;
            mixer.removeEventListener("loop", check);
            mixer.removeEventListener("finished", check);
          }
        };
        mixer.addEventListener("loop", check);
        mixer.addEventListener("finished", check);
      }
    };

    if (playbackDelay > 0) {
      playbackTimeoutRef.current = window.setTimeout(() => {
        playbackTimeoutRef.current = null;
        startPlayback();
      }, playbackDelay * 1000);
      return undefined;
    }

    startPlayback();
    return undefined;
  }, [actions, fps, mixer, mode, playbackDelay, playbackRange, trigger]);

  useEffect(() => {
    targetRef.current = isVisible ? 1 : 0;
    if (isVisible !== lastVisibleRef.current) {
      const shouldSnapVisibleOnReverse =
        isVisible && (mode === "playBackward" || mode === "playRange");

      if (shouldSnapVisibleOnReverse) {
        pendingRef.current = false;
        delayLeftRef.current = 0;
        progressRef.current = 1;
        opacityRef.current = 1;
        matsRef.current.forEach((m) => {
          m.opacity = 1;
        });
        lastVisibleRef.current = isVisible;
        return;
      }

      const delay = isVisible ? inDelay : outDelay;
      if (delay > 0) {
        pendingRef.current = true;
        delayLeftRef.current = delay;
      }
      lastVisibleRef.current = isVisible;
    }
  }, [inDelay, isVisible, mode, outDelay]);

  useFrame((_, dt) => {
    if (pendingRef.current) {
      delayLeftRef.current -= dt;
      if (delayLeftRef.current > 0) return;
      pendingRef.current = false;
    }
    const target = targetRef.current;
    let progress = progressRef.current;
    if (Math.abs(progress - target) < 1e-4) return;
    const dir = target > progress ? 1 : -1;
    const activeDuration = dir > 0 ? duration : outDuration ?? duration;
    progress += (dt / activeDuration) * dir;
    progress = THREE.MathUtils.clamp(progress, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    matsRef.current.forEach((m) => {
      m.opacity = eased;
    });
    opacityRef.current = eased;
    progressRef.current = progress;
  });

  if (!scene) return null;
  return (
    <group ref={group} position={position} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}
