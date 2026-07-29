import * as THREE from "three";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFrame } from "@react-three/fiber";
import {
  Text,
  useAnimations,
  useCubeTexture,
  useCursor,
  useGLTF,
} from "@react-three/drei";
import { useRoute } from "wouter";
import { SkeletonUtils } from "three-stdlib";

import { useARSupport } from "../../hooks/useARSupport";
import { assetUrl } from "../../utils/paths";
import { publishPortalSceneDebug, summarizeSceneGraph } from "../../utils/sceneDebug";
import { setCurrentMaxxContext } from "../../world-model/runtimeContext";
import { launchMaxxAr } from "./ar";
import { useGlobalArTrigger } from "./useGlobalArTrigger";
import { useMaxxVoiceRegistry } from "./useMaxxVoiceRegistry";
import { useMaxxPhaseSync } from "./useMaxxPhaseSync";

export const Model1 = ({ position, scale, portalId }) => {
  const group = useRef();
  const { scene, animations } = useGLTF(assetUrl("/n3.glb"), true);
  const { actions } = useAnimations(animations, group);
  const [, params] = useRoute("/neo/:id");
  const isActive = params?.id === portalId;

  useEffect(() => {
    if (!actions) return;
    Object.values(actions).forEach((action) => {
      if (!action) return;
      action.paused = !isActive;
      if (isActive && !action.isRunning()) {
        action.reset().play();
      }
    });
  }, [actions, isActive]);

  useEffect(() => {
    if (!group.current || !position) return;
    group.current.position.set(...position);
    group.current.scale.set(1.4, 1.4, 1.4);
    group.current.rotation.set(-0.1, 9.4, 0.773);
  }, [position, scale]);

  useEffect(() => {
    if (!scene || portalId !== "maxx") return;

    publishPortalSceneDebug(
      "maxx",
      "Model1",
      summarizeSceneGraph(scene, {
        animationNames: animations?.map((clip) => clip.name) || [],
        state: {
          active: isActive,
          clipStates: Object.entries(actions || {}).map(([name, action]) => ({
            name,
            paused: Boolean(action?.paused),
            running: Boolean(action?.isRunning?.()),
          })),
        },
      })
    );
  }, [actions, animations, isActive, portalId, scene]);

  return (
    <primitive
      ref={group}
      object={scene}
      dispose={null}
      raycast={false}
      receiveShadow={false}
      castShadow={false}
    />
  );
};

export const AnimatedModel = ({ position, scale, onModelClick, portalId }) => {
  const group = useRef();
  const { isMobile } = useARSupport();
  const n2xPath = assetUrl("/n2x.glb");
  const neuroPath = assetUrl("/neurodesign.glb");
  const meetJozEnvFaces = useMemo(
    () =>
      isMobile
        ? ["nx8-m.webp", "px8-m.webp", "py8-m.webp", "ny8-m.webp", "nz8-m.webp", "pz8-m.webp"]
        : ["nx8.webp", "px8.webp", "py8.webp", "ny8.webp", "nz8.webp", "pz8.webp"],
    [isMobile]
  );
  const meetJozEnvMap = useCubeTexture(meetJozEnvFaces, {
    path: assetUrl("/"),
  });
  const { scene: n2xScene, animations: n2xAnims } = useGLTF(n2xPath, true);
  const { actions: n2xActions, mixer: n2xMixer } = useAnimations(n2xAnims, group);

  const glassMat = useMemo(() => {
    const material = new THREE.MeshPhysicalMaterial({
      color: "white",
      metalness: 0,
      roughness: 0,
      transmission: 1,
      ior: 1.5,
      thickness: 0.5,
      reflectivity: 0.9,
      clearcoat: 0.1,
      clearcoatRoughness: 0.3,
      transparent: true,
      depthWrite: false,
    });
    material.iridescenceThicknessRange = [233, 434];
    return material;
  }, []);

  useEffect(() => {
    if (n2xScene && group.current) {
      group.current.updateMatrixWorld(true);
    }
  }, [n2xScene]);

  const { scene: neuroScene, animations: neuroAnims } = useGLTF(neuroPath);
  const clonedNeuroScene = useMemo(
    () => (neuroScene ? SkeletonUtils.clone(neuroScene) : null),
    [neuroScene]
  );

  useLayoutEffect(() => {
    if (!clonedNeuroScene || !meetJozEnvMap) return;

    const patchMaterial = (material) => {
      if (!material || (material.name || "").trim() !== "1") {
        return material;
      }

      const nextMaterial = material.clone();
      nextMaterial.envMap = meetJozEnvMap;
      nextMaterial.envMapIntensity = Math.max(nextMaterial.envMapIntensity ?? 1, 2.2);
      nextMaterial.needsUpdate = true;
      return nextMaterial;
    };

    clonedNeuroScene.traverse((object) => {
      if (!object.isMesh || !object.material) return;

      if (Array.isArray(object.material)) {
        object.material = object.material.map(patchMaterial);
        return;
      }

      object.material = patchMaterial(object.material);
    });
  }, [clonedNeuroScene, meetJozEnvMap]);

  const neuroMixer = useRef(null);
  useEffect(() => {
    if (!clonedNeuroScene || !neuroAnims?.length) return;
    const mixer = new THREE.AnimationMixer(clonedNeuroScene);
    neuroMixer.current = mixer;
    neuroAnims.forEach((clip) => mixer.clipAction(clip).reset().play());
    return () => {
      mixer.stopAllAction();
      neuroMixer.current = null;
    };
  }, [clonedNeuroScene, neuroAnims]);

  const [, params] = useRoute("/neo/:id");
  const isActive = params?.id === portalId;
  const [showNeuro, setShowNeuro] = useState(false);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered, "pointer");

  useEffect(() => {
    if (group.current && position) {
      group.current.position.set(...position);
      group.current.scale.set(0.0135, 0.0135, 0.0135);
    }
  }, [position, scale]);

  const handleClick = () => {
    setShowNeuro((prev) => !prev);
    onModelClick?.();
  };

  useMaxxVoiceRegistry({
    actions: n2xActions,
    onPause: () => {
      console.log("🧠 [Voice] Showing neurodesign.glb (pause/stop state)");
      setShowNeuro(true);
      if (neuroMixer.current) neuroMixer.current.timeScale = 1;
    },
    onResume: () => {
      console.log("🧠 [Voice] Hiding neurodesign.glb (resume/play state)");
      setShowNeuro(false);
    },
    logPrefix: "[VoiceModel]",
    registerMessage: "Registered n2x voice handlers (pause/resume flow)",
    unregisterMessage: "Unregistered n2x voice handlers",
  });

  useEffect(() => {
    if (!n2xActions) return;
    Object.values(n2xActions).forEach((action) => {
      if (!action) return;
      action.clampWhenFinished = false;
      action.setLoop(THREE.LoopRepeat, Infinity);

      const shouldPlay = isActive && !showNeuro;
      if (shouldPlay && !action.isRunning()) {
        action.play();
      }

      action.paused = !shouldPlay;
    });
  }, [isActive, showNeuro, n2xActions]);

  useMaxxPhaseSync({
    portalId,
    isActive,
    actions: n2xActions,
    paused: showNeuro,
    pausedPhase: "inside_the_brain",
    setCurrentMaxxContext,
  });

  useEffect(() => {
    if (!neuroMixer.current) return;
    neuroMixer.current.timeScale = isActive && showNeuro ? 1 : 0;
  }, [isActive, showNeuro]);

  useEffect(() => {
    if (portalId !== "maxx") return;

    publishPortalSceneDebug("maxx", "AnimatedModel", {
      n2x: summarizeSceneGraph(n2xScene, {
        animationNames: n2xAnims?.map((clip) => clip.name) || [],
        interactiveHints: ["qq", "neuron", "space"],
        state: {
          active: isActive,
          showNeuro,
          clipStates: Object.entries(n2xActions || {}).map(([name, action]) => ({
            name,
            paused: Boolean(action?.paused),
            running: Boolean(action?.isRunning?.()),
          })),
        },
      }),
      neurodesign: summarizeSceneGraph(clonedNeuroScene, {
        animationNames: neuroAnims?.map((clip) => clip.name) || [],
        interactiveHints: ["armature", "space", "jkx"],
        state: {
          active: isActive,
          visible: showNeuro,
          mixerActive: Boolean(neuroMixer.current && isActive && showNeuro),
        },
      }),
    });
  }, [
    clonedNeuroScene,
    isActive,
    n2xActions,
    n2xAnims,
    n2xScene,
    neuroAnims,
    portalId,
    showNeuro,
  ]);

  useFrame((_, delta) => {
    if (n2xMixer && isActive && !showNeuro) {
      n2xMixer.update(delta * 0.4);
    }

    if (neuroMixer.current && isActive && showNeuro) {
      neuroMixer.current.update(delta * 0.4);
    }
  });

  const alphaNeuro = useRef(0);
  useFrame((_, delta) => {
    const target = showNeuro ? 1 : 0;
    alphaNeuro.current = THREE.MathUtils.damp(alphaNeuro.current, target, 3, delta);
    const opacity = alphaNeuro.current;
    const isFading = opacity > 0.001 && opacity < 0.999;
    const visible = opacity > 0.02;

    clonedNeuroScene?.traverse((object) => {
      if (!object.isMesh || !object.material) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];

      materials.forEach((material) => {
        if (!material) return;

        if (material.userData.__baseTransparent === undefined) {
          material.userData.__baseTransparent = material.transparent;
          material.userData.__baseDepthWrite = material.depthWrite;
          material.userData.__baseOpacity = material.opacity ?? 1;
        }

        material.transparent = isFading || opacity < 0.999 || material.userData.__baseTransparent;
        material.depthWrite = !isFading && visible && material.userData.__baseDepthWrite !== false;
        material.opacity = (material.userData.__baseOpacity ?? 1) * opacity;
      });

      object.visible = visible;
      object.raycast = visible ? THREE.Mesh.prototype.raycast : () => {};
    });
  });

  useEffect(() => {
    if (!n2xScene) return;

    const timer = setTimeout(() => {
      const mesh = n2xScene.getObjectByName("qq.002");
      if (!mesh) {
        console.warn("⚠️ mesh not found, check console dump above");
        return;
      }

      console.log("🎯 found", mesh.name, "with material", mesh.material?.name);

      if (mesh.material?.name === "glassX") {
        mesh.material = glassMat.clone();
        mesh.material.needsUpdate = true;
        console.log("✅ glassMat applied directly");
      } else {
        console.warn("⚠️ material name was", mesh.material?.name);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [glassMat, n2xScene]);

  return (
    <>
      {n2xScene && (
        <primitive
          ref={group}
          object={n2xScene}
          dispose={null}
          onClick={handleClick}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        />
      )}

      {clonedNeuroScene && (
        <group position={[0, 0.1, -2.42]} scale={[0.01, 0.01, 0.01]}>
          <primitive
            object={clonedNeuroScene}
            onClick={handleClick}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
          />
        </group>
      )}
    </>
  );
};

export function AnimatedModelMobile({
  position = [0, -0.78, -2],
  scale = [0.0135, 0.0135, 0.0135],
  portalId,
  playbackSpeed = 0.5,
  arUsdzUrl = "https://meetjoz.com/neurodesign.usdz",
  arGlbUrl = "https://meetjoz.com/neurovibes.glb",
}) {
  const group = useRef();
  const { scene: meSrc, animations } = useGLTF(assetUrl("/n2xm.glb"));
  const me = useMemo(() => (meSrc ? SkeletonUtils.clone(meSrc) : null), [meSrc]);
  const { actions } = useAnimations(animations, me);
  const [, params] = useRoute("/neo/:id");
  const isActive = params?.id === portalId;
  const [hovered, setHovered] = useState(false);
  useCursor(hovered, "pointer");

  useEffect(() => {
    if (!actions) return;
    Object.values(actions).forEach((action) => {
      if (!action) return;
      action.clampWhenFinished = false;
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.setEffectiveTimeScale?.(playbackSpeed);

      if (isActive && !action.isRunning()) {
        action.play();
      }

      action.paused = !isActive;
    });
  }, [actions, isActive, playbackSpeed]);

  const launchAR = useCallback(() => {
    launchMaxxAr({ arUsdzUrl, arGlbUrl });
  }, [arGlbUrl, arUsdzUrl]);

  useGlobalArTrigger(launchAR, "AnimatedModelMobile");

  if (!me) return null;

  const { isMobile } = useARSupport();
  useMaxxVoiceRegistry({
    enabled: isMobile,
    actions,
    onPause: () => {
      console.log("🧠 [Mobile Voice] Pausing n2x.glb animation");
    },
    onResume: () => {
      console.log("🧠 [Mobile Voice] Resuming n2x.glb animation");
    },
    logPrefix: "[VoiceModelMobile]",
    registerMessage: "Registered n2x voice handler for mobile",
    unregisterMessage: "Unregistered n2x voice handler for mobile",
  });

  useMaxxPhaseSync({
    portalId,
    isActive,
    actions,
    activeFallbackPhase: "signal_flow",
    setCurrentMaxxContext,
  });

  return (
    <group
      ref={group}
      position={position}
      scale={scale}
      onPointerDown={(event) => {
        event.stopPropagation();
        launchAR();
      }}
      onClick={(event) => {
        event.stopPropagation();
        launchAR();
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <primitive object={me} />
      <Text position={[0, 1.2, 0]} fontSize={0.1} color="white">
        Open in Space
      </Text>
    </group>
  );
}

export function AnimatedModelMobilexr({
  position = [0, -0.78, -2],
  scale = [0.0135, 0.0135, 0.0135],
  portalId,
  playbackSpeed = 0.5,
  arUsdzUrl = "https://meetjoz.com/neurodesign.usdz",
  arGlbUrl = "https://meetjoz.com/neurovibes.glb",
}) {
  const group = useRef();
  const { scene: meSrc, animations } = useGLTF(assetUrl("/n2xmar.glb"));
  const me = useMemo(() => (meSrc ? SkeletonUtils.clone(meSrc) : null), [meSrc]);
  const { actions } = useAnimations(animations, me);
  const [, params] = useRoute("/neo/:id");
  const isActive = params?.id === portalId;
  const [hovered, setHovered] = useState(false);
  useCursor(hovered, "pointer");

  useEffect(() => {
    if (!actions) return;
    Object.values(actions).forEach((action) => {
      if (!action) return;
      action.clampWhenFinished = false;
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.setEffectiveTimeScale?.(playbackSpeed);

      if (isActive && !action.isRunning()) {
        action.play();
      }

      action.paused = !isActive;
    });
  }, [actions, isActive, playbackSpeed]);

  const launchAR = useCallback(() => {
    launchMaxxAr({ arUsdzUrl, arGlbUrl });
  }, [arGlbUrl, arUsdzUrl]);

  useGlobalArTrigger(launchAR, "AnimatedModelMobilexr");

  if (!me) return null;

  const { isMobile } = useARSupport();
  useMaxxVoiceRegistry({
    enabled: isMobile,
    actions,
    onPause: () => {
      console.log("🧠 [Mobile Voice] Pausing n2x.glb animation");
    },
    onResume: () => {
      console.log("🧠 [Mobile Voice] Resuming n2x.glb animation");
    },
    logPrefix: "[VoiceModelMobile]",
    registerMessage: "Registered n2x voice handler for mobile",
    unregisterMessage: "Unregistered n2x voice handler for mobile",
  });

  useMaxxPhaseSync({
    portalId,
    isActive,
    actions,
    activeFallbackPhase: "signal_flow",
    setCurrentMaxxContext,
  });

  return (
    <group
      ref={group}
      position={position}
      scale={scale}
      onPointerDown={(event) => {
        event.stopPropagation();
        launchAR();
      }}
      onClick={(event) => {
        event.stopPropagation();
        launchAR();
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <primitive object={me} />
      <Text position={[0, 1.2, 0]} fontSize={0.1} color="white">
        Open in Space
      </Text>
    </group>
  );
}

export const Aura = ({
  position = [0, -0.6, 18],
  scale = [3, 3, 3],
  portalId,
  playbackSpeed = 0.5,
}) => {
  const group = useRef();
  const { scene, animations } = useGLTF(assetUrl("/aura.glb"));
  const { actions, mixer } = useAnimations(animations, group);
  const [, params] = useRoute("/neo/:id");
  const isActive = params?.id === portalId;

  useEffect(() => {
    if (!group.current) return;
    group.current.position.set(...position);
    group.current.scale.set(...scale);
  }, [position, scale]);

  useEffect(() => {
    if (!actions) return;
    Object.values(actions).forEach((action) => {
      if (!action) return;
      action.reset()?.play();
      action.paused = !isActive;
      action.setEffectiveTimeScale(playbackSpeed);
    });

    if (mixer) mixer.timeScale = playbackSpeed;
    return () => mixer?.stopAllAction();
  }, [actions, isActive, mixer, playbackSpeed]);

  useFrame((_, delta) => {
    if (mixer && isActive) {
      mixer.update(delta * playbackSpeed);
    }
  });

  return (
    <primitive
      ref={group}
      object={scene}
      dispose={null}
      raycast={false}
      receiveShadow={false}
      castShadow={false}
    />
  );
};
