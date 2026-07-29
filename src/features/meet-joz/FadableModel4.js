import * as THREE from "three";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useCursor, useGLTF } from "@react-three/drei";
import { useRoute } from "wouter";

import { SkeletonUtils } from "three-stdlib";

import { useARSupport } from "../../hooks/useARSupport";
import { assetUrl } from "../../utils/paths";
import {
  publishPortalSceneDebug,
  summarizeSceneGraph,
} from "../../utils/sceneDebug";

export function FadableModel4({
  stabilizePortalAlphaMaterial,
  url = "/workf.glb",
  position = [0, -0.7, -2],
  scale = [1.5, 1.5, 1.5],
  isVisible = true,
  duration = 0.9,
  inDelay = 0,
  outDelay = 0,
  resetTrigger = 0,
  portalId,
  playbackSpeed = 0.8,
  resumeFromSkills,
  pauseFromBack1,
  toggleJkxRef,
  onInteractiveReadyChange,
}) {
  const group = useRef();
  const [isPaused, setIsPaused] = useState(true);

  const { isMobile } = useARSupport();

  const modelUrl = isMobile ? "workf-m.glb" : url;
  const { scene: src, animations } = useGLTF(assetUrl(modelUrl));
  const scene = useMemo(() => (src ? SkeletonUtils.clone(src) : null), [src]);
  const { actions, mixer } = useAnimations(animations, group);

  const glbFilePath = isMobile ? "/jkx-m.glb" : "/jkx-d.glb";
  const { nodes } = useGLTF(assetUrl(glbFilePath));

  const [showNewModel, setShowNewModel] = useState(false);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered, "pointer");

  useEffect(() => {
    setShowNewModel(false);
  }, [resetTrigger]);

  const [, params] = useRoute("/neo/:id");
  const isActive = params?.id === portalId;

  const matsRef = useRef([]);
  const progressRef = useRef(0);
  const opacityRef = useRef(0);
  const targetRef = useRef(0);
  const pendingRef = useRef(false);
  const delayLeftRef = useRef(0);
  const lastVisibleRef = useRef(isVisible);
  const interactiveReadyRef = useRef(false);
  const resumeOnPortalReenterRef = useRef(false);

  const jkxAlphaRef = useRef(0);
  const jkxTargetRef = useRef(0);

  const glassMat = useMemo(() => {
    const material = new THREE.MeshPhysicalMaterial({
      color: "white",
      metalness: 0,
      roughness: 0,
      transmission: 1,
      ior: 1.8,
      thickness: 2,
      reflectivity: 0.4,
      clearcoat: 0.2,
      clearcoatRoughness: 0.1,
      iridescence: 1,
      iridescenceIOR: 0.9,
    });
    material.iridescenceThicknessRange = [233, 434];
    return material;
  }, []);

  useLayoutEffect(() => {
    if (!scene) return;
    matsRef.current = [];

    scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;

      let mat;
      if (!isMobile) {
        const name = (o.material.name || "").toLowerCase();
        if (
          name.includes("pp.056") ||
          name.includes("pp.026") ||
          name.includes("pp.022") ||
          name.includes("pp.012") ||
          name.includes("pp.72") ||
          name.includes("pp.018") ||
          name.includes("pp.036") ||
          name.includes("pp.007") ||
          name.includes("pp.017") ||
          name.includes("pp.073") ||
          name.includes("pp.048") ||
          name.includes("pp.069") ||
          name.includes("pp.049") ||
          name.includes("pp.027") ||
          name.includes("pp.071") ||
          name.includes("pp.037") ||
          name.includes("pp.070") ||
          name.includes("pp.072") ||
          name.includes("qq.008") ||
          name.includes("pp.050")
        ) {
          mat = glassMat.clone();
        } else {
          mat = o.material.clone();
        }
      } else {
        mat = o.material;
      }

      mat.transparent = true;
      mat.opacity = 0;
      mat.depthWrite = false;
      stabilizePortalAlphaMaterial(mat);

      o.material = mat;
      matsRef.current.push(mat);

      o.onBeforeRender = () => {
        o.material.opacity = opacityRef.current;
      };
    });

    progressRef.current = 0;
    opacityRef.current = 0;
    targetRef.current = isVisible ? 1 : 0;
  }, [scene, glassMat, isVisible, isMobile, stabilizePortalAlphaMaterial]);

  useLayoutEffect(() => {
    if (!nodes?.Scene) return;

    nodes.Scene.visible = false;

    nodes.Scene.traverse((o) => {
      if (o.isMesh && o.material) {
        if ((o.material.name || "").toLowerCase() === "") {
          o.material = glassMat.clone();
        }

        o.material.transparent = true;
        o.material.opacity = 0;
        o.material.depthWrite = false;
        stabilizePortalAlphaMaterial(o.material);

        o.onBeforeRender = () => {
          o.material.opacity = jkxAlphaRef.current;
        };
      }
    });

    jkxAlphaRef.current = 0;
    jkxTargetRef.current = 0;
  }, [glassMat, nodes, stabilizePortalAlphaMaterial]);

  useEffect(() => {
    if (!scene) return;
    scene.traverse((o) => {
      if (o.isMesh) {
        o.raycast = () => null;
      }
    });
  }, [scene]);

  useEffect(() => {
    if (!actions) return;
    Object.values(actions).forEach((a) => {
      if (!a) return;
      a.reset()?.play();
      a.paused = true;
      a.setEffectiveTimeScale?.(playbackSpeed);
    });
    if (mixer) mixer.timeScale = playbackSpeed;

    setIsPaused(true);
    console.log("[FadableModel4] animations initialized -> paused");

    return () => mixer?.stopAllAction();
  }, [actions, mixer, playbackSpeed]);

  useEffect(() => {
    if (!resumeFromSkills) return undefined;
    resumeFromSkills.current = () => {
      console.log("[FadableModel4] resumeFromSkills -> playing animations");
      Object.values(actions || {}).forEach((a) => {
        if (!a) return;
        a.paused = false;
        a.play();
      });
      setIsPaused(false);
    };
    return () => {
      if (resumeFromSkills.current) {
        resumeFromSkills.current = null;
      }
    };
  }, [resumeFromSkills, actions]);

  useEffect(() => {
    if (!pauseFromBack1) return undefined;
    pauseFromBack1.current = () => {
      console.log("[FadableModel4] pauseFromBack1 -> pausing animations");
      setShowNewModel(false);
      Object.values(actions || {}).forEach((a) => {
        if (!a) return;
        a.paused = true;
      });
      setIsPaused(true);
    };
    return () => {
      if (pauseFromBack1.current) {
        pauseFromBack1.current = null;
      }
    };
  }, [pauseFromBack1, actions]);

  useEffect(() => {
    if (!toggleJkxRef) return undefined;
    toggleJkxRef.current = () => {
      if (!isVisible || !interactiveReadyRef.current) return;
      if (isMobile) {
        launchDigitalTwinAR();
        return;
      }
      setShowNewModel((prev) => !prev);
    };
    return () => {
      if (toggleJkxRef.current) {
        toggleJkxRef.current = null;
      }
    };
  }, [isVisible, isMobile, toggleJkxRef]);

  useEffect(() => {
    if (typeof onInteractiveReadyChange === "function") {
      onInteractiveReadyChange(false);
    }
    interactiveReadyRef.current = false;
  }, [isVisible, onInteractiveReadyChange]);

  useEffect(() => {
    if (!actions) return;

    if (!isActive) {
      resumeOnPortalReenterRef.current = isVisible && !isPaused;
      Object.values(actions).forEach((a) => {
        if (!a) return;
        a.paused = true;
      });
      if (resumeOnPortalReenterRef.current) {
        setIsPaused(true);
      }
      return;
    }

    if (!resumeOnPortalReenterRef.current || !isVisible) return;

    Object.values(actions).forEach((a) => {
      if (!a) return;
      a.paused = false;
      a.play();
    });
    setIsPaused(false);
    resumeOnPortalReenterRef.current = false;
  }, [actions, isActive, isPaused, isVisible]);

  useFrame((_, dt) => {
    if (mixer && isActive && !isPaused) {
      mixer.update(dt);
    }

    if (pendingRef.current) {
      delayLeftRef.current -= dt;
      if (delayLeftRef.current > 0) return;
      pendingRef.current = false;
    }

    const target = targetRef.current;
    let progress = progressRef.current;
    if (Math.abs(progress - target) < 1e-4) return;

    const dir = target > progress ? 1 : -1;
    progress += (dt / duration) * dir;
    progress = THREE.MathUtils.clamp(progress, 0, 1);

    const eased = progress * progress * (3 - 2 * progress);
    matsRef.current.forEach((m) => {
      m.opacity = eased;
    });
    opacityRef.current = eased;
    progressRef.current = progress;

    const nextInteractiveReady = isVisible && eased >= 0.98;
    if (interactiveReadyRef.current !== nextInteractiveReady) {
      interactiveReadyRef.current = nextInteractiveReady;
      onInteractiveReadyChange?.(nextInteractiveReady);
    }
  });

  useEffect(() => {
    jkxTargetRef.current = showNewModel ? 1 : 0;
  }, [showNewModel]);

  useFrame((_, delta) => {
    if (!isActive) return;

    const alpha = jkxAlphaRef.current;
    const target = jkxTargetRef.current;
    if (nodes?.Scene) {
      nodes.Scene.visible = alpha > 1e-3 || target > 1e-3;
    }
    if (Math.abs(alpha - target) < 1e-4) return;

    const next = THREE.MathUtils.damp(alpha, target, 3.2, delta);
    jkxAlphaRef.current = next;

    if (nodes?.Scene) {
      nodes.Scene.visible = next > 1e-3 || target > 1e-3;
      nodes.Scene.traverse((o) => {
        if (o.isMesh && o.material?.transparent) {
          o.material.opacity = next;
        }
      });
    }
  });

  const isHitNamed = (obj, base) => {
    const target = base.toLowerCase();
    while (obj) {
      const name = (obj.name || "").toLowerCase();
      if (
        name === target ||
        name.startsWith(`${target}.`) ||
        name.startsWith(`${target}_`) ||
        name.startsWith(`${target}-`) ||
        name.includes(target)
      ) {
        return true;
      }
      obj = obj.parent;
    }
    return false;
  };

  const handlePointerDown = (e) => {
    if (isHitNamed(e.object, "skills")) {
      console.log("[FadableModel4] Skills mesh clicked -> RESUME animations");
      Object.values(actions || {}).forEach((a) => {
        if (!a) return;
        a.paused = false;
        a.play();
      });
      setIsPaused(false);
      return;
    }

    if (isHitNamed(e.object, "back1")) {
      console.log("[FadableModel4] Back1 mesh clicked -> PAUSE animations");
      Object.values(actions || {}).forEach((a) => {
        if (!a) return;
        a.paused = true;
      });
      setIsPaused(true);
    }
  };

  useEffect(() => {
    if (portalId !== "meet-joz") return;

    publishPortalSceneDebug("meet-joz", "FadableModel4", {
      workf: summarizeSceneGraph(scene, {
        animationNames: animations?.map((clip) => clip.name) || [],
        interactiveHints: ["skills", "back1", "space", "armature"],
        state: {
          active: isActive,
          visible: isVisible,
          paused: isPaused,
          showNewModel,
        },
      }),
      jkx: summarizeSceneGraph(nodes?.Scene, {
        interactiveHints: ["jkx", "space", "armature"],
        state: {
          active: isActive,
          visible: showNewModel,
        },
      }),
    });
  }, [
    animations,
    isActive,
    isPaused,
    isVisible,
    nodes,
    portalId,
    scene,
    showNewModel,
  ]);

  const arThrottleRef = useRef(false);
  function launchDigitalTwinAR() {
    if (!nodes || arThrottleRef.current) return;
    arThrottleRef.current = true;

    const ua = navigator.userAgent || "";
    const isiOS =
      (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);
    const isFirefox = /firefox/i.test(ua);
    const isOculus = /OculusBrowser/.test(ua);
    const canAndroidAR = isAndroid && !isFirefox && !isOculus;

    if (isiOS) {
      const hasWK = Boolean(window.webkit && window.webkit.messageHandlers);
      const quickLookSupported = !hasWK
        ? (() => {
            const tempAnchor = document.createElement("a");
            return Boolean(
              tempAnchor.relList &&
                tempAnchor.relList.supports &&
                tempAnchor.relList.supports("ar")
            );
          })()
        : /CriOS\/|EdgiOS\/|FxiOS\/|GSA\/|DuckDuckGo\//.test(ua);

      if (quickLookSupported) {
        const link = document.createElement("a");
        link.textContent = "Spatial Diamond";
        link.href = "https://meetjoz.com/Joz-Liquid-Glass-3D-CV.usdz";
        link.rel = "ar";

        const img = document.createElement("img");
        img.src = assetUrl("/usdz.png");
        img.alt = "Spatial Diamond";
        link.appendChild(img);

        document.body.appendChild(link);
        requestAnimationFrame(() => {
          link.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
            })
          );
          setTimeout(() => link.remove(), 1000);
        });
      }

      window.setTimeout(() => {
        arThrottleRef.current = false;
      }, 1000);
      return;
    }

    if (canAndroidAR) {
      const link = document.createElement("a");
      link.textContent = "Spatial Diamond";
      link.href =
        "intent://arvr.google.com/scene-viewer/1.0?file=https://meetjoz.com/Joz-Liquid-Glass-3D-CV.glb#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=https://developers.google.com/ar;end;";
      document.body.appendChild(link);
      requestAnimationFrame(() => {
        link.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
          })
        );
        setTimeout(() => link.remove(), 1000);
      });

      window.setTimeout(() => {
        arThrottleRef.current = false;
      }, 2000);
      return;
    }

    arThrottleRef.current = false;
  }

  const handleA1xModelClick = (e) => {
    e?.stopPropagation?.();
    launchDigitalTwinAR();
  };

  useEffect(() => {
    window.__triggerAR_Extra = () => {
      launchDigitalTwinAR();
    };
    return () => delete window.__triggerAR_Extra;
  }, [showNewModel, nodes]);

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

  if (!scene) return null;
  return (
    <>
      <group
        ref={group}
        position={position}
        scale={scale}
        onPointerDown={handlePointerDown}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <primitive object={scene} />
      </group>

      {nodes && (
        <group position={[0, -0.1, -2.82]} scale={[0.01, 0.01, 0.01]}>
          <primitive
            object={nodes.Scene}
            onPointerDown={isMobile ? handleA1xModelClick : undefined}
            onClick={!isMobile ? handleA1xModelClick : undefined}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
          />
        </group>
      )}
    </>
  );
}
