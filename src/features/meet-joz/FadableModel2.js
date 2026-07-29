import * as THREE from "three";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { useRoute } from "wouter";

import { SkeletonUtils } from "three-stdlib";

import { useARSupport } from "../../hooks/useARSupport";
import { assetUrl } from "../../utils/paths";

export function FadableModel2({
  stabilizePortalAlphaMaterial,
  position = [0, -1, -2],
  scale = [0.5, 0.5, 0.5],
  isVisible = false,
  duration = 10,
  outDuration = null,
  inDelay = 0,
  outDelay = 0,
  forcedOpacity = null,
  portalId,
  speedFactor = 0.5,
}) {
  const group = useRef();
  const { isMobile } = useARSupport();
  const url = isMobile ? "/worldx-m.glb" : "/worldx.glb";

  const { scene: src, animations } = useGLTF(assetUrl(url));
  const scene = useMemo(() => (src ? SkeletonUtils.clone(src) : null), [src]);
  const { actions, mixer } = useAnimations(animations, group);

  const [, params] = useRoute("/neo/:id");
  const isActive = params?.id === portalId;

  useEffect(() => {
    if (!actions) return;
    Object.values(actions).forEach((a) => {
      if (!a) return;
      a.clampWhenFinished = false;
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.play();
      a.paused = !isActive;
    });
    return () => mixer?.stopAllAction();
  }, [actions, isActive, mixer]);

  const matsRef = useRef([]);
  const progressRef = useRef(0);
  const opacityRef = useRef(0);
  const targetRef = useRef(0);
  const pendingRef = useRef(false);
  const delayLeftRef = useRef(0);
  const lastVisibleRef = useRef(isVisible);

  useLayoutEffect(() => {
    if (!scene) return;
    matsRef.current = [];

    scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      if (o.name === "qq.002") return;

      const setUp = (mat) => {
        const next = mat.clone();
        next.transparent = true;
        next.opacity = 0;
        next.alphaTest = 0;
        next.depthWrite = false;
        next.premultipliedAlpha = false;
        stabilizePortalAlphaMaterial(next);
        return next;
      };

      if (Array.isArray(o.material)) {
        o.material = o.material.map(setUp);
        matsRef.current.push(...o.material);
      } else {
        o.material = setUp(o.material);
        matsRef.current.push(o.material);
      }

      o.renderOrder = 10;
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

    progressRef.current = 0;
    opacityRef.current = 0;
    targetRef.current = isVisible ? 1 : 0;
  }, [isVisible, scene, stabilizePortalAlphaMaterial]);

  useLayoutEffect(() => {
    if (!scene) return;

    scene.traverse((o) => {
      if (!o.isMesh) return;
      if (o.name.includes("qq")) {
        const glassMat = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          roughness: 0.05,
          metalness: 0,
          transmission: 1.0,
          ior: 1.5,
          thickness: 0.5,
          clearcoat: 1.0,
          clearcoatRoughness: 0,
        });

        o.material = glassMat;
        matsRef.current.push(glassMat);

        o.renderOrder = 10;
        o.onBeforeRender = () => {
          o.material.opacity = opacityRef.current;
        };
      }
    });

    progressRef.current = 0;
    opacityRef.current = 0;
    targetRef.current = isVisible ? 1 : 0;
  }, [isVisible, scene]);

  useEffect(() => {
    if (forcedOpacity !== null) {
      targetRef.current = forcedOpacity;
    }
  }, [forcedOpacity]);

  useEffect(() => {
    if (isVisible && inDelay > 0) {
      pendingRef.current = true;
      delayLeftRef.current = inDelay;
    }
  }, [inDelay, isVisible]);

  useEffect(() => {
    targetRef.current = isVisible ? 1 : 0;
    if (isVisible !== lastVisibleRef.current) {
      const delay = isVisible ? inDelay : outDelay;
      if (delay > 0) {
        pendingRef.current = true;
        delayLeftRef.current = delay;
      }
      lastVisibleRef.current = isVisible;
    }
  }, [inDelay, isVisible, outDelay]);

  useFrame((_, dt) => {
    if (mixer && isActive) {
      mixer.update(dt * speedFactor);
    }

    if (pendingRef.current) {
      delayLeftRef.current -= dt;
      if (delayLeftRef.current > 0) return;
      pendingRef.current = false;
    }

    const target = forcedOpacity !== null ? forcedOpacity : targetRef.current;
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

  const handleClick = () => {
    if (!actions) return;
    Object.values(actions).forEach((a) => {
      if (!a) return;
      a.paused = !a.paused;
    });
  };

  if (!scene) return null;
  return (
    <group ref={group} position={position} scale={scale} onClick={handleClick}>
      <primitive object={scene} />
    </group>
  );
}
