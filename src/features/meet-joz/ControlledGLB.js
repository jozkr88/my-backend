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
import { useAnimations, useCursor, useGLTF } from "@react-three/drei";
import { useRoute } from "wouter";

import { useARSupport } from "../../hooks/useARSupport";
import { assetUrl } from "../../utils/paths";
import {
  publishPortalSceneDebug,
  summarizeSceneGraph,
} from "../../utils/sceneDebug";
import {
  getMeetJozFrameState,
  getMeetJozRewindStage,
  MEET_JOZ_ASCEND_EXIT_END_F,
  MEET_JOZ_DISC_STOP_F,
  MEET_JOZ_SKILLS_REVEAL_END_F,
  MEET_JOZ_SKILLS_REVEAL_START_F,
  MEET_JOZ_SKILLS_RESUME_TO_F,
  MEET_JOZ_TWIN_WORKF_END_F,
  MEET_JOZ_TWIN_WORKF_START_F,
  MEET_JOZ_VIBE_STOP_F,
} from "../../world-model/meetJoz";
import { setCurrentMeshContext } from "../../world-model/runtimeContext";

function stabilizeControlledGlbMaterial(material) {
  if (!material) return;

  const isTransmissive =
    typeof material.transmission === "number" && material.transmission > 0;
  const hasAlphaTexture = Boolean(material.alphaMap);
  const baseOpacity =
    material.userData.controlledBaseOpacity ?? material.opacity ?? 1;

  material.userData.controlledBaseOpacity = baseOpacity;
  material.depthTest = true;
  material.premultipliedAlpha = false;

  if (hasAlphaTexture && !isTransmissive) {
    if ("alphaHash" in material) {
      material.alphaHash = true;
      material.transparent = false;
    } else {
      material.transparent = false;
      material.alphaTest = Math.max(material.alphaTest || 0, 0.08);
      if ("alphaToCoverage" in material) material.alphaToCoverage = true;
    }

    material.opacity = 1;
    material.depthWrite = true;
    material.needsUpdate = true;
    return;
  }

  if (isTransmissive || baseOpacity < 0.999 || material.transparent) {
    material.transparent = true;
    material.opacity = baseOpacity;
    material.depthWrite = false;
    material.needsUpdate = true;
    return;
  }

  material.transparent = false;
  material.opacity = 1;
  material.depthWrite = true;
  material.needsUpdate = true;
}

export function ControlledGLB({
  url = "/model1.glb",
  fps = 24,
  defaultClipName,
  partRegex,
  fitSize = 2.0,
  onVibeClick,
  onVibeRest,
  onDiscoverClick,
  onDiscoverActiveChange,
  onMetaballsVisibleChange,
  onMetaballsProgressChange,
  onBackClick,
  onSkillsClick,
  onBack1Click,
  onWorkStepExitStart,
  onWorld8ExitStart,
  onWorldxExitAtRewindTime,
  onWorldxEnterAtRewindTime,
  onVoiceReadyChange,
  onDigitalTwinToggle,
  isWorkStepVisible = false,
  isWorkStepActive = false,
  portalId,
  playbackSpeed = 1,
}) {
  const group = useRef();
  const { isMobile } = useARSupport();
  const { scene, animations } = useGLTF(assetUrl(url));
  const { actions, names, mixer } = useAnimations(animations, group);

  const [, params] = useRoute("/neo/:id");
  const isActive = params?.id === portalId;

  const isInMeetPortal = portalId === "meet-joz";
  const workStepBlocking = isWorkStepVisible || isWorkStepActive;
  const twinTriggerNames = isMobile
    ? ["Armature.001", "00x"]
    : ["00x", "Armature.001"];

  const skillsClickedRef = useRef(false);
  const pendingSkillsAdvanceRef = useRef(false);
  const skillsAdvanceCompletedRef = useRef(false);
  const blockToggleUntilPointerUpRef = useRef(false);
  const lastDiscoverActiveRef = useRef(null);
  const pendingWorldxExitRef = useRef(false);
  const pendingWorldxEnterRef = useRef(false);
  const WORLDX_REWIND_HIDE_AT_S = 2;

  const glassMat = useMemo(() => {
    const material = new THREE.MeshPhysicalMaterial({
      color: "white",
      metalness: 0,
      roughness: 0,
      transmission: true,
      ior: 1,
      thickness: 0,
      reflectivity: 0.9,
      clearcoat: 0.1,
      clearcoatRoughness: 0.3,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    material.iridescenceThicknessRange = [233, 434];
    return material;
  }, []);

  useLayoutEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    scene.position.sub(center);
    scene.scale.setScalar(fitSize / Math.max(size.x, size.y, size.z));
  }, [scene, fitSize]);

  useLayoutEffect(() => {
    if (!scene) return;
    scene.traverse((o) => {
      if (o.isMesh && o.material) {
        const swap = (mat) => {
          const name = (mat.name || "").toLowerCase();
          const targets = ["jk", "ss.001"];
          if (targets.some((t) => name === t || name.includes(t))) {
            return glassMat.clone();
          }
          return mat;
        };
        if (Array.isArray(o.material)) {
          o.material = o.material.map(swap);
        } else {
          o.material = swap(o.material);
        }
      }
    });
  }, [scene, glassMat]);

  useLayoutEffect(() => {
    if (!scene) return;

    scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;

      if (Array.isArray(o.material)) {
        o.material = o.material.map((mat) => {
          const next = mat?.clone?.() ?? mat;
          stabilizeControlledGlbMaterial(next);
          return next;
        });
        return;
      }

      const next = o.material.clone?.() ?? o.material;
      stabilizeControlledGlbMaterial(next);
      o.material = next;
    });
  }, [scene]);

  useLayoutEffect(() => {
    if (!scene) return;
    scene.traverse((o) => {
      const isGeometry = o.isMesh || o.isLine || o.isSprite || o.isPoints;
      const isNonGeom = !isGeometry || o.isBone || o.type === "Bone";
      if (isNonGeom) {
        o.raycast = () => null;
        o.userData.ignorePointer = true;
      }
    });
  }, [scene]);

  useLayoutEffect(() => {
    if (!scene) return;
    const empty = scene.getObjectByName("Plane");
    if (empty) {
      empty.raycast = () => null;
      empty.userData.ignorePointer = true;
    }
    ["1", "2", "3"].forEach((n) => {
      const mesh = scene.getObjectByName(n);
      if (mesh) {
        mesh.raycast = () => null;
        mesh.userData.ignorePointer = true;
      }
    });
  }, [scene]);

  const [current, setCurrent] = useState(null);

  const partClip = useMemo(() => {
    if (!animations?.length || !partRegex) return null;
    const base = defaultClipName
      ? THREE.AnimationClip.findByName(animations, defaultClipName)
      : animations[0];
    if (!base) return null;
    const filtered = base.tracks.filter((t) => partRegex.test(t.name));
    return new THREE.AnimationClip(`${base.name}-part`, base.duration, filtered);
  }, [animations, defaultClipName, partRegex]);

  const partActionRef = useRef(null);
  useEffect(() => {
    if (!partClip || !group.current) return;
    const action = mixer.clipAction(partClip, group.current);
    action.clampWhenFinished = true;
    action.setLoop(THREE.LoopOnce, 0);
    action.paused = true;
    partActionRef.current = action;
    return () => {
      action?.stop?.();
      partActionRef.current = null;
    };
  }, [partClip, mixer]);

  useEffect(() => {
    Object.values(actions).forEach((a) => {
      if (!a) return;
      a.reset();
      a.clampWhenFinished = true;
      a.setLoop(THREE.LoopOnce, 0);
      a.paused = true;
      a.setEffectiveTimeScale?.(playbackSpeed);
    });
    if (mixer) mixer.timeScale = playbackSpeed;
    const first = defaultClipName ?? names[0];
    if (first && actions[first]) setCurrent(first);
  }, [actions, names, defaultClipName, playbackSpeed, mixer]);

  const getAction = (name = current) =>
    name === "part" ? partActionRef.current : actions[name];

  // ControlledGLB stays mounted across portals. It is only ready to receive a
  // deferred voice sequence when Meet Joz is the active portal; otherwise the
  // ready signal would remain true and never fire again on re-entry.
  const isVoiceReady =
    isInMeetPortal && isActive && Boolean(scene) && Boolean(getAction());

  useEffect(() => {
    if (typeof onVoiceReadyChange !== "function") return undefined;
    onVoiceReadyChange(isVoiceReady);

    return () => {
      onVoiceReadyChange(false);
    };
  }, [isVoiceReady, onVoiceReadyChange]);

  const seek = (t, name = current) => {
    const action = getAction(name);
    if (!action) return;
    const duration = action.getClip().duration;
    action.paused = true;
    action.time = THREE.MathUtils.clamp(t, 0, duration);
    mixer.update(0);
  };
  const pause = (name = current) => {
    const action = getAction(name);
    if (action) {
      action.paused = true;
      mixer.update(0);
    }
  };
  const toggle = (name = current) => {
    const action = getAction(name);
    if (action) {
      action.paused = !action.paused;
      action.play();
    }
  };

  const rewindingRef = useRef(false);
  const rewindCompleteRef = useRef(null);
  const rewindTargetRef = useRef(0);
  const rewindSpeedRef = useRef(3.6);
  const rewindMinFactorRef = useRef(0.25);
  const rewindEasePowerRef = useRef(1);
  const rewindRampWindowRef = useRef(1);
  const rewindEaseStartRef = useRef(null);
  const forwardPlayingRef = useRef(false);
  const goalStopTimeRef = useRef(null);
  const forwardCompleteRef = useRef(null);
  const controlledSequenceIdRef = useRef(0);
  const controlledSequenceStateRef = useRef(null);
  const controlledSequenceContinueRef = useRef(null);
  const suppressNextClickRef = useRef(false);

  const REWIND_SPEED = 3.6;
  const BACK1_REWIND_SPEED = playbackSpeed * 4;
  const DEFAULT_REWIND_RAMP_WINDOW = 1;
  const BACK1_REWIND_MIN_FACTOR = 1;
  const BACK1_REWIND_EASE_POWER = 1;
  const BACK1_REWIND_EASE_START_F = null;
  const SKILLS_FORCE_SCALE = 4.520391464233398;

  const [hoveringAction, setHoveringAction] = useState(false);
  useCursor(hoveringAction, "pointer");
  const lastMetaballsVisibleRef = useRef(null);
  const lastMetaballsProgressRef = useRef(null);
  const back1VisualsHiddenRef = useRef(false);
  const resumeOnPortalReenterRef = useRef(false);

  const syncBack1Visuals = useCallback(
    (hidden) => {
      if (!scene) return;
      back1VisualsHiddenRef.current = hidden;

      scene.traverse((o) => {
        if (!o.isMesh) return;
        const n = (o.name || "").toLowerCase().trim();
        if (
          n === "mogg" ||
          n.startsWith("mogg.") ||
          n.startsWith("mogg_") ||
          n.startsWith("mogg-")
        ) {
          o.visible = !hidden;
        }
      });
    },
    [scene]
  );

  useEffect(() => {
    if (!scene) return;

    scene.traverse((o) => {
      if (!o.isMesh) return;
      const n = (o.name || "").toLowerCase().trim();
      if (
        n === "mogg1" ||
        n.startsWith("mogg1.") ||
        n.startsWith("mogg1_") ||
        n.startsWith("mogg1-")
      ) {
        o.raycast = () => null;
      }
    });
  }, [scene]);

  const syncSkillsVisuals = useCallback(
    (visible) => {
      if (!scene) return;

      scene.traverse((o) => {
        const n = (o.name || "").toLowerCase().trim();
        if (
          n === "skills" ||
          n.startsWith("skills.") ||
          n.startsWith("skills_") ||
          n.startsWith("skills-")
        ) {
          o.visible = visible;
          if (visible) {
            o.scale.setScalar(SKILLS_FORCE_SCALE);
            o.quaternion.set(0, 0, 0, 1);
            o.userData.forceSkillsFrontFacing = true;
          } else {
            o.scale.set(0, 0, 0);
            o.quaternion.set(0, 0, 0, 1);
            o.userData.forceSkillsFrontFacing = false;
          }
        }
      });
    },
    [scene]
  );

  useEffect(() => {
    syncBack1Visuals(false);
  }, [syncBack1Visuals]);

  const startRewindTo = (
    stopAtSec,
    name = current,
    {
      speed = REWIND_SPEED,
      minFactor = 0.25,
      easePower = 1,
      rampWindow = DEFAULT_REWIND_RAMP_WINDOW,
      easeStartAt = null,
    } = {}
  ) => {
    const action = getAction(name);
    if (!action) return;
    action.enabled = true;
    action.clampWhenFinished = true;
    action.setLoop(THREE.LoopOnce, 0);
    action.play();
    action.paused = true;
    rewindingRef.current = true;
    rewindTargetRef.current = stopAtSec;
    rewindSpeedRef.current = speed;
    rewindMinFactorRef.current = minFactor;
    rewindEasePowerRef.current = easePower;
    rewindRampWindowRef.current = Math.max(0.001, rampWindow);
    rewindEaseStartRef.current = easeStartAt;
    forwardPlayingRef.current = false;
    goalStopTimeRef.current = null;
    forwardCompleteRef.current = null;
  };

  const playForwardTo = (
    goalSec,
    startSec = null,
    speed = playbackSpeed,
    name = current,
    onComplete = null
  ) => {
    const action = getAction(name);
    if (!action) return;
    if (startSec != null) action.time = startSec;
    action.setEffectiveTimeScale?.(speed) ?? (mixer.timeScale = speed);
    action.clampWhenFinished = true;
    action.setLoop(THREE.LoopOnce, 0);
    action.paused = false;
    action.play();
    forwardPlayingRef.current = true;
    rewindingRef.current = false;
    goalStopTimeRef.current = goalSec;
    forwardCompleteRef.current = onComplete;
  };

  const completeSkillsAdvance = () => {
    if (skillsAdvanceCompletedRef.current) return;
    pendingSkillsAdvanceRef.current = false;
    skillsAdvanceCompletedRef.current = true;
    onSkillsClick?.();
  };

  useEffect(() => {
    const activeAction = getAction();
    if (!activeAction) return;

    if (!isActive) {
      if (isInMeetPortal) {
        controlledSequenceIdRef.current += 1;
        controlledSequenceStateRef.current = null;
        controlledSequenceContinueRef.current = null;
        rewindingRef.current = false;
        forwardPlayingRef.current = false;
        goalStopTimeRef.current = null;
        pendingSkillsAdvanceRef.current = false;
        skillsAdvanceCompletedRef.current = false;
        skillsClickedRef.current = false;
        resumeOnPortalReenterRef.current = false;
        activeAction.reset();
        activeAction.paused = true;
        syncSkillsVisuals(false);
        syncBack1Visuals(false);
        mixer.update(0);
      } else {
        resumeOnPortalReenterRef.current =
          rewindingRef.current ||
          forwardPlayingRef.current ||
          !activeAction.paused;

        activeAction.paused = true;
        mixer.update(0);
      }
      return;
    }

    if (!resumeOnPortalReenterRef.current) return;

    if (rewindingRef.current) {
      activeAction.paused = true;
    } else {
      activeAction.paused = false;
      activeAction.play();
    }
    mixer.update(0);
    resumeOnPortalReenterRef.current = false;
  }, [isActive, current, mixer, getAction, isInMeetPortal, syncSkillsVisuals, syncBack1Visuals]);

  useFrame((state, delta) => {
    if (!isActive) return;

    const dt = Math.min(delta, 1 / 60);

    if (rewindingRef.current) {
      const action = getAction();
      if (action) {
        if (
          pendingWorldxEnterRef.current &&
          action.time <= WORLDX_REWIND_SHOW_AT_S + 1e-3
        ) {
          pendingWorldxEnterRef.current = false;
          onWorldxEnterAtRewindTime?.();
        }
        if (
          pendingWorldxExitRef.current &&
          action.time <= WORLDX_REWIND_HIDE_AT_S + 1e-3
        ) {
          pendingWorldxExitRef.current = false;
          onWorldxExitAtRewindTime?.();
        }
        const target = rewindTargetRef.current;
        const dist = Math.max(0, action.time - target);
        const easeStartAt = rewindEaseStartRef.current;
        const isBeforeEaseWindow = easeStartAt != null && action.time > easeStartAt;
        const rampWindow =
          easeStartAt != null
            ? Math.max(0.001, easeStartAt - target)
            : rewindRampWindowRef.current;
        const ramp = isBeforeEaseWindow
          ? 1
          : THREE.MathUtils.clamp(dist / rampWindow, 0, 1);
        const easedRamp = Math.pow(ramp, rewindEasePowerRef.current);
        const step =
          dt *
          rewindSpeedRef.current *
          (rewindMinFactorRef.current +
            (1 - rewindMinFactorRef.current) * easedRamp);
        const next = Math.max(target, action.time - step);
        action.time = next;
        mixer.update(0);
        if (Math.abs(next - target) < 1e-3) {
          action.time = target;
          action.paused = true;
          mixer.update(0);
          rewindingRef.current = false;
          pendingWorldxEnterRef.current = false;
          pendingWorldxExitRef.current = false;
          const onComplete = rewindCompleteRef.current;
          rewindCompleteRef.current = null;
          onComplete?.();
        }
      }
    } else if (mixer) {
      mixer.update(dt);
    }

    const action = getAction();

    if (forwardPlayingRef.current && goalStopTimeRef.current != null) {
      if (action && action.time >= goalStopTimeRef.current - 1e-3) {
        action.time = goalStopTimeRef.current;
        action.paused = true;
        mixer.update(0);
        forwardPlayingRef.current = false;
        goalStopTimeRef.current = null;
        const onComplete = forwardCompleteRef.current;
        forwardCompleteRef.current = null;
        onComplete?.();
      }
    }

    const controlledSequence = controlledSequenceStateRef.current;
    const controlledSequenceAction = getAction();
    if (
      controlledSequence &&
      controlledSequence.waiting &&
      controlledSequenceAction &&
      !forwardPlayingRef.current &&
      !rewindingRef.current &&
      controlledSequenceAction.time >= controlledSequence.targetTime - 2 / fps
    ) {
      controlledSequence.waiting = false;
      const continueSequence = controlledSequenceContinueRef.current;
      controlledSequenceContinueRef.current = null;
      continueSequence?.();
    }

    if (
      action &&
      pendingSkillsAdvanceRef.current &&
      action.time >= SKILLS_WORK_TRIGGER_AT / fps - 1e-3
    ) {
      completeSkillsAdvance();
    }

    if (scene && action) {
      const shouldShowSkills =
        !workStepBlocking &&
        action.time >= Vibe_STOP_F / fps - 1e-3 &&
        action.time <= SKILLS_RESUME_TO / fps + 1e-3;
      syncSkillsVisuals(shouldShowSkills);

      scene.traverse((o) => {
        if (o.userData?.forceSkillsFrontFacing) {
          const cameraWorldQuat = new THREE.Quaternion();
          const parentWorldQuat = new THREE.Quaternion();
          state.camera.getWorldQuaternion(cameraWorldQuat);
          if (o.parent) {
            o.parent.getWorldQuaternion(parentWorldQuat);
            parentWorldQuat.invert();
            o.quaternion.copy(cameraWorldQuat).premultiply(parentWorldQuat);
          } else {
            o.quaternion.copy(cameraWorldQuat);
          }
        }
      });

      if (!back1VisualsHiddenRef.current) {
        scene.traverse((o) => {
          if (!o.isMesh) return;
          const n = (o.name || "").toLowerCase().trim();
          if (
            n === "mogg" ||
            n.startsWith("mogg.") ||
            n.startsWith("mogg_") ||
            n.startsWith("mogg-")
          ) {
            const shouldShowMogg =
              !isWorkStepActive &&
              action.time < SKILLS_RESUME_TO / fps - 1e-3;
            if (o.visible !== shouldShowMogg) {
              o.visible = shouldShowMogg;
            }
          }

          if (
            n === "mogg1" ||
            n.startsWith("mogg1.") ||
            n.startsWith("mogg1_") ||
            n.startsWith("mogg1-")
          ) {
            if (!o.visible) {
              o.visible = true;
            }
          }
        });
      }
    }
  });

  const isHitBack = (obj) => {
    while (obj) {
      const n = (obj.name || "").toLowerCase().trim();
      if (
        n === "back" ||
        n.startsWith("back.") ||
        n.startsWith("back_") ||
        n.startsWith("back-")
      ) {
        return true;
      }
      obj = obj.parent;
    }
    return false;
  };

  const isHitBack1 = (obj) => {
    while (obj) {
      const n = (obj.name || "").toLowerCase().trim();
      if (
        n === "back1" ||
        n.startsWith("back1.") ||
        n.startsWith("back1_") ||
        n.startsWith("back1-")
      ) {
        return true;
      }
      obj = obj.parent;
    }
    return false;
  };

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

  const isHitNamedExact = (obj, base) => {
    const target = base.toLowerCase();
    while (obj) {
      const name = (obj.name || "").toLowerCase().trim();
      if (name === target) {
        return true;
      }
      obj = obj.parent;
    }
    return false;
  };

  const isHitAny = (obj, names) => names.some((n) => isHitNamed(obj, n));
  const isHitAnyExact = (obj, names) =>
    names.some((n) => isHitNamedExact(obj, n));

  const isSkillsTriggerHit = (obj) =>
    isHitAny(obj, ["skills", "mogg", "mogg1"]) ||
    isHitAnyExact(obj, ["xx", "xx.010", "xx.07"]);

  const isJjTriggerHit = (obj) => isHitNamed(obj, "jj");

  const isDiscoverTriggerHit = (obj) =>
    isHitNamed(obj, "Discover") || isHitNamed(obj, "gg");

  const isTwinTriggerHit = (obj) => isHitAny(obj, twinTriggerNames);
  const isTwinLikeTriggerHit = (obj) =>
    isTwinTriggerHit(obj) || isJjTriggerHit(obj);

  const handlePointerOver = (e) => {
    const action = getAction();
    const minFrame = DISC_STOP_AT / fps;
    const maxFrame = (SKILLS_RESUME_TO + 8) / fps;
    const inRange = action && action.time >= minFrame && action.time <= maxFrame;
    const twinInteractionBlocked = rewindingRef.current;
    const twinReady =
      action &&
      !twinInteractionBlocked &&
      action.time >= TWIN_TOGGLE_START_F / fps;
    const twinHasWorkStepVisible =
      isInMeetPortal && (isWorkStepVisible || isWorkStepActive);
    const twinJkxWindowActive =
      !twinInteractionBlocked &&
      (twinHasWorkStepVisible ||
        (isInMeetPortal &&
          action &&
          action.time > TWIN_WORKF_END_F / fps + 1e-3));
    const twinWorkfWindowActive =
      !twinInteractionBlocked &&
      isInMeetPortal &&
      !isWorkStepVisible &&
      !isWorkStepActive &&
      action &&
      action.time >= TWIN_WORKF_START_F / fps - 1e-3 &&
      action.time <= TWIN_WORKF_END_F / fps + 1e-3;
    const twinClickable =
      isTwinLikeTriggerHit(e.object) &&
      (twinWorkfWindowActive ||
        twinJkxWindowActive ||
        (isWorkStepActive && twinReady));

    const isHoverTarget =
      isHitBack(e.object) ||
      isHitBack1(e.object) ||
      isHitNamed(e.object, "Vibe") ||
      isDiscoverTriggerHit(e.object) ||
      twinClickable ||
      (!workStepBlocking && inRange && isSkillsTriggerHit(e.object));

    setHoveringAction(isHoverTarget);
    if (typeof document !== "undefined") {
      document.body.style.cursor = isHoverTarget ? "pointer" : "auto";
    }
  };

  const handlePointerMove = handlePointerOver;
  const handlePointerOut = () => {
    setHoveringAction(false);
    if (typeof document !== "undefined") {
      document.body.style.cursor = "auto";
    }
  };

  const Vibe_STOP_F = MEET_JOZ_VIBE_STOP_F;
  const DISC_STOP_AT = MEET_JOZ_DISC_STOP_F;
  const CROSSJUMP_ASCEND_STOP_F = MEET_JOZ_ASCEND_EXIT_END_F - 8;
  const TWIN_WORKF_START_F = MEET_JOZ_TWIN_WORKF_START_F;
  const TWIN_WORKF_END_F = MEET_JOZ_TWIN_WORKF_END_F;
  const SKILLS_REVEAL_START_F = MEET_JOZ_SKILLS_REVEAL_START_F;
  const SKILLS_REVEAL_END_F = MEET_JOZ_SKILLS_REVEAL_END_F;
  const SKILLS_RESUME_TO = MEET_JOZ_SKILLS_RESUME_TO_F;
  const TWIN_TOGGLE_START_F = TWIN_WORKF_END_F;
  const SKILLS_WORK_TRIGGER_AT = SKILLS_REVEAL_END_F;
  const WORLDX_REWIND_SHOW_AT_S = SKILLS_WORK_TRIGGER_AT / fps;
  const BACK1_STOP_F = 70;
  const VIBE_REWIND_HOLD_F = Vibe_STOP_F - 0.5;
  const DISCOVER_REWIND_HOLD_F = DISC_STOP_AT - 0.5;

  const triggerVibeStep = useCallback((onComplete = null) => {
    suppressNextClickRef.current = true;
    blockToggleUntilPointerUpRef.current = true;
    pendingSkillsAdvanceRef.current = false;
    skillsAdvanceCompletedRef.current = false;
    syncBack1Visuals(false);
    const action = getAction();
    if (!action) return false;
    const targetTime = VIBE_REWIND_HOLD_F / fps;
    if (action.time > targetTime + 1e-3) {
      forwardPlayingRef.current = false;
      goalStopTimeRef.current = null;
      rewindCompleteRef.current = () => {
        onVibeClick?.();
        onComplete?.();
      };
      startRewindTo(targetTime, undefined, {
        speed: BACK1_REWIND_SPEED,
        minFactor: BACK1_REWIND_MIN_FACTOR,
        easePower: BACK1_REWIND_EASE_POWER,
        easeStartAt: BACK1_REWIND_EASE_START_F / fps,
      });
      setCurrentMeshContext("vibe", { stage: "vibe_back" });
    } else {
      action.reset();
      playForwardTo(Vibe_STOP_F / fps, 0, playbackSpeed, current, onComplete);
      onVibeClick?.();
      setCurrentMeshContext("vibe", { stage: "ascend_opening" });
    }
    console.log("🌐 currentMesh -> vibe");
    return true;
  }, [
    fps,
    current,
    onVibeClick,
    playbackSpeed,
    playForwardTo,
    startRewindTo,
    syncBack1Visuals,
    VIBE_REWIND_HOLD_F,
    BACK1_REWIND_SPEED,
    BACK1_REWIND_MIN_FACTOR,
    BACK1_REWIND_EASE_POWER,
    BACK1_REWIND_EASE_START_F,
  ]);

  const restartVibeFromBeginning = useCallback(() => {
    const action = getAction();
    if (!action) return false;

    console.log("🎬 Restarting Flex from frame 0");
    suppressNextClickRef.current = true;
    blockToggleUntilPointerUpRef.current = true;
    rewindingRef.current = false;
    forwardPlayingRef.current = false;
    goalStopTimeRef.current = null;
    pendingSkillsAdvanceRef.current = false;
    skillsAdvanceCompletedRef.current = false;
    skillsClickedRef.current = false;
    syncSkillsVisuals(false);
    syncBack1Visuals(false);
    action.reset();
    action.time = 0;
    action.paused = true;
    mixer.update(0);
    onVibeClick?.();
    setCurrentMeshContext("vibe");
    playForwardTo(Vibe_STOP_F / fps, 0);
    return true;
  }, [
    Vibe_STOP_F,
    fps,
    mixer,
    onVibeClick,
    playForwardTo,
    syncBack1Visuals,
    syncSkillsVisuals,
    getAction,
  ]);

  const returnVibeToRestFrame = useCallback(() => {
    const action = getAction();
    if (!action) return false;

    console.log("🎬 Returning Flex by rewinding to frame 1");
    suppressNextClickRef.current = true;
    blockToggleUntilPointerUpRef.current = true;
    pendingSkillsAdvanceRef.current = false;
    skillsAdvanceCompletedRef.current = false;
    skillsClickedRef.current = false;
    syncSkillsVisuals(false);
    syncBack1Visuals(false);
    pendingWorldxEnterRef.current = false;
    pendingWorldxExitRef.current = Boolean(
      action.time > WORLDX_REWIND_HIDE_AT_S + 1e-3
    );
    if (!pendingWorldxExitRef.current) {
      onWorldxExitAtRewindTime?.();
    }
    const finalizeVibeReturn = () => {
      if (typeof onVibeRest === "function") onVibeRest();
      else onVibeClick?.();
      setCurrentMeshContext("vibe", { stage: "flex_stop" });
      console.log("🌐 currentMesh -> vibe/flex_stop @ frame 1");
    };

    setCurrentMeshContext("vibe", { stage: "vibe_back" });
    const stopTime = 1 / fps;
    if (action.time > stopTime + 1e-3) {
      forwardPlayingRef.current = false;
      goalStopTimeRef.current = null;
      rewindCompleteRef.current = finalizeVibeReturn;
      startRewindTo(stopTime, undefined, {
        speed: BACK1_REWIND_SPEED,
        minFactor: BACK1_REWIND_MIN_FACTOR,
        easePower: BACK1_REWIND_EASE_POWER,
        easeStartAt: BACK1_REWIND_EASE_START_F / fps,
      });
    } else {
      rewindingRef.current = false;
      forwardPlayingRef.current = false;
      goalStopTimeRef.current = null;
      rewindCompleteRef.current = null;
      action.reset();
      action.time = stopTime;
      action.paused = true;
      mixer.update(0);
      finalizeVibeReturn();
    }
    return true;
  }, [
    fps,
    mixer,
    onVibeClick,
    onVibeRest,
    onWorldxExitAtRewindTime,
    startRewindTo,
    syncBack1Visuals,
    syncSkillsVisuals,
    BACK1_REWIND_SPEED,
    BACK1_REWIND_MIN_FACTOR,
    BACK1_REWIND_EASE_POWER,
    BACK1_REWIND_EASE_START_F,
    WORLDX_REWIND_HIDE_AT_S,
    getAction,
  ]);

  const triggerBackSequence = useCallback(
    (onLanding) => {
      suppressNextClickRef.current = true;
      blockToggleUntilPointerUpRef.current = true;
      pendingSkillsAdvanceRef.current = false;
      skillsAdvanceCompletedRef.current = false;
      syncBack1Visuals(false);
      onWorkStepExitStart?.();
      onWorld8ExitStart?.();
      const activeAction = getAction();
      pendingWorldxEnterRef.current = false;
      pendingWorldxExitRef.current = Boolean(
        activeAction && activeAction.time > WORLDX_REWIND_HIDE_AT_S + 1e-3
      );
      if (!pendingWorldxExitRef.current) {
        onWorldxExitAtRewindTime?.();
      }
      forwardPlayingRef.current = false;
      goalStopTimeRef.current = null;
      rewindCompleteRef.current = () => {
        onLanding?.();
      };
      setCurrentMeshContext(null, { stage: "vibe_back" });
      startRewindTo(0);
      return true;
    },
    [
      getAction,
      onWorkStepExitStart,
      onWorld8ExitStart,
      onWorldxExitAtRewindTime,
      startRewindTo,
      syncBack1Visuals,
      WORLDX_REWIND_HIDE_AT_S,
    ]
  );

  const triggerBack1Sequence = useCallback(
    (onLanding) => {
      suppressNextClickRef.current = true;
      blockToggleUntilPointerUpRef.current = true;
      pendingSkillsAdvanceRef.current = false;
      skillsAdvanceCompletedRef.current = false;
      syncBack1Visuals(true);
      onWorkStepExitStart?.();
      const activeAction = getAction();
      pendingWorldxEnterRef.current = Boolean(
        activeAction && activeAction.time > WORLDX_REWIND_SHOW_AT_S + 1e-3
      );
      if (!pendingWorldxEnterRef.current) {
        onWorldxEnterAtRewindTime?.();
      }
      pendingWorldxExitRef.current = false;
      if (skillsClickedRef.current) {
        syncSkillsVisuals(false);
        skillsClickedRef.current = false;
      }
      forwardPlayingRef.current = false;
      goalStopTimeRef.current = null;
      rewindCompleteRef.current = () => {
        onLanding?.();
      };
      const stopAt = BACK1_STOP_F / fps;
      console.log("⏪ Rewind -> Back1 (rewind to Vibe stop)", stopAt, "sec");
      setCurrentMeshContext("discover", { stage: "vibe_back1" });
      startRewindTo(stopAt, undefined, {
        speed: BACK1_REWIND_SPEED,
        minFactor: BACK1_REWIND_MIN_FACTOR,
        easePower: BACK1_REWIND_EASE_POWER,
        easeStartAt: BACK1_REWIND_EASE_START_F / fps,
      });
      return true;
    },
    [
      fps,
      getAction,
      onWorkStepExitStart,
      onWorldxEnterAtRewindTime,
      startRewindTo,
      syncBack1Visuals,
      syncSkillsVisuals,
      BACK1_REWIND_SPEED,
      BACK1_REWIND_MIN_FACTOR,
      BACK1_REWIND_EASE_POWER,
      BACK1_REWIND_EASE_START_F,
      WORLDX_REWIND_SHOW_AT_S,
    ]
  );

  const triggerDiscoverStep = useCallback(
    (onComplete = null, stopAtFrame = DISC_STOP_AT) => {
    suppressNextClickRef.current = true;
    blockToggleUntilPointerUpRef.current = true;
    pendingSkillsAdvanceRef.current = false;
    skillsAdvanceCompletedRef.current = false;
    syncBack1Visuals(false);
    const action = getAction();
    if (!action) return false;
    syncSkillsVisuals(true);
    const targetTime = DISCOVER_REWIND_HOLD_F / fps;
    if (action.time > targetTime + 1e-3) {
      forwardPlayingRef.current = false;
      goalStopTimeRef.current = null;
      rewindCompleteRef.current = () => {
        onDiscoverClick?.();
        onComplete?.();
      };
      startRewindTo(targetTime);
      setCurrentMeshContext("discover", { stage: "vibe_back1" });
    } else {
      playForwardTo(
        stopAtFrame / fps,
        Math.max(action.time, Vibe_STOP_F / fps),
        playbackSpeed,
        current,
        onComplete
      );
      setCurrentMeshContext("discover", { stage: "ascend_opening" });
      onDiscoverClick?.();
      }
      console.log("🌐 currentMesh -> discover");
      return true;
    },
    [
      current,
      fps,
      onDiscoverClick,
      playbackSpeed,
      playForwardTo,
      startRewindTo,
      syncBack1Visuals,
      syncSkillsVisuals,
      DISCOVER_REWIND_HOLD_F,
      getAction,
      Vibe_STOP_F,
      DISC_STOP_AT,
    ]
  );

  const triggerSkillsStep = useCallback(() => {
    suppressNextClickRef.current = true;
    blockToggleUntilPointerUpRef.current = true;
    pendingSkillsAdvanceRef.current = false;
    skillsAdvanceCompletedRef.current = false;
    syncBack1Visuals(false);
    const action = getAction();
    if (!action) return false;

    syncSkillsVisuals(true);

    const minFrame = 0;
    const maxFrame = (SKILLS_RESUME_TO + 8) / fps;
    if (action.time < minFrame || action.time > maxFrame) return false;

    if (action.time >= (SKILLS_RESUME_TO - 2) / fps && !workStepBlocking) {
      completeSkillsAdvance();
      setCurrentMeshContext("skills", { stage: "skills" });
      console.log("🌐 currentMesh -> skills");
      return true;
    }

    const startAt = Math.max(action.time, minFrame);
    playForwardTo(SKILLS_RESUME_TO / fps, startAt);
    skillsClickedRef.current = true;
    pendingSkillsAdvanceRef.current = true;
    skillsAdvanceCompletedRef.current = false;
    setCurrentMeshContext("skills", { stage: "skills" });
    console.log("🌐 currentMesh -> skills");
    return true;
  }, [
    completeSkillsAdvance,
    fps,
    playForwardTo,
    syncBack1Visuals,
    syncSkillsVisuals,
    workStepBlocking,
    getAction,
    SKILLS_RESUME_TO,
  ]);

  const triggerControlledClickSequence = useCallback(
    (steps = []) => {
      const sequence = Array.isArray(steps)
        ? steps.map((step) => String(step || "").toLowerCase().trim()).filter(Boolean)
        : [];
      if (!sequence.length) return false;

      const sequenceId = controlledSequenceIdRef.current + 1;
      controlledSequenceIdRef.current = sequenceId;
      console.log("🧭 ControlledGLB sequence start:", sequence);

      const runStep = (index, attempt = 0) => {
        if (controlledSequenceIdRef.current !== sequenceId) return false;

        const step = sequence[index];
        if (!step) {
          controlledSequenceStateRef.current = null;
          controlledSequenceContinueRef.current = null;
          console.log("🧭 ControlledGLB sequence complete:", sequence);
          return true;
        }

        console.log("🧭 ControlledGLB sequence step:", step, {
          index,
          attempt,
        });

        let triggered = false;
        let targetFrame = null;
        if (step === "vibe") {
          triggered = triggerVibeStep();
          targetFrame = Vibe_STOP_F;
        }
        if (step === "discover_crossjump") {
          targetFrame = CROSSJUMP_ASCEND_STOP_F;
          triggered = triggerDiscoverStep(null, targetFrame);
        }
        if (step === "discover") {
          triggered = triggerDiscoverStep();
          targetFrame = DISC_STOP_AT;
        }
        if (step === "skills") {
          triggered = triggerSkillsStep();
          targetFrame = SKILLS_RESUME_TO;
        }

        if (!triggered && attempt < 20) {
          window.setTimeout(() => runStep(index, attempt + 1), 100);
          return true;
        }

        if (!triggered) {
          console.warn("⚠️ ControlledGLB sequence step failed:", {
            sequence,
            step,
            index,
          });
        }

        if (triggered && Number.isFinite(targetFrame)) {
          controlledSequenceStateRef.current = {
            id: sequenceId,
            index,
            targetTime: targetFrame / fps,
            waiting: true,
          };
          controlledSequenceContinueRef.current = () => {
            if (controlledSequenceIdRef.current !== sequenceId) return;
            runStep(index + 1);
          };
        }
        return triggered;
      };

      return runStep(0);
    },
    [triggerDiscoverStep, triggerSkillsStep, triggerVibeStep]
  );

  const handlePointerDown = (e) => {
    if (isHitBack(e.object)) {
      e.stopPropagation();
      if (isInMeetPortal) {
        triggerBackSequence(onBackClick);
      } else {
        startRewindTo(0);
        onBackClick?.();
      }
      return;
    }
    if (isHitBack1(e.object)) {
      e.stopPropagation();
      onBack1Click?.();
      triggerBack1Sequence();
      return;
    }

    if (isHitNamed(e.object, "Vibe")) {
      e.stopPropagation();
      triggerVibeStep();
      return;
    }

    if (isDiscoverTriggerHit(e.object)) {
      e.stopPropagation();
      triggerDiscoverStep();
      return;
    }

    const twinAction = getAction();
    const twinInteractionBlocked = rewindingRef.current;
    const twinHasWorkStepVisible =
      isInMeetPortal && (isWorkStepVisible || isWorkStepActive);
    const twinJkxWindowActive =
      !twinInteractionBlocked &&
      (twinHasWorkStepVisible ||
        (isInMeetPortal &&
          twinAction &&
          twinAction.time > TWIN_WORKF_END_F / fps + 1e-3));
    const twinWorkfWindowActive =
      !twinInteractionBlocked &&
      isInMeetPortal &&
      !isWorkStepVisible &&
      !isWorkStepActive &&
      twinAction &&
      twinAction.time >= TWIN_WORKF_START_F / fps - 1e-3 &&
      twinAction.time <= TWIN_WORKF_END_F / fps + 1e-3;

    if (isTwinLikeTriggerHit(e.object) && twinHasWorkStepVisible) {
      e.stopPropagation();
      suppressNextClickRef.current = true;
      blockToggleUntilPointerUpRef.current = true;
      onDigitalTwinToggle?.("jkx");
      return;
    }

    if (isTwinLikeTriggerHit(e.object) && twinWorkfWindowActive) {
      e.stopPropagation();
      suppressNextClickRef.current = true;
      blockToggleUntilPointerUpRef.current = true;
      onDigitalTwinToggle?.("workf");
      return;
    }

    if (isTwinLikeTriggerHit(e.object) && twinJkxWindowActive) {
      e.stopPropagation();
      suppressNextClickRef.current = true;
      blockToggleUntilPointerUpRef.current = true;
      onDigitalTwinToggle?.("jkx");
      return;
    }

    if (isWorkStepActive && isTwinLikeTriggerHit(e.object)) {
      e.stopPropagation();
      suppressNextClickRef.current = true;
      blockToggleUntilPointerUpRef.current = true;
      const action = getAction();
      if (!action || action.time < TWIN_TOGGLE_START_F / fps) {
        return;
      }
      onDigitalTwinToggle?.("jkx");
      return;
    }

    if (isTwinLikeTriggerHit(e.object)) {
      e.stopPropagation();
      suppressNextClickRef.current = true;
      blockToggleUntilPointerUpRef.current = true;
      return;
    }

    if (!workStepBlocking && isSkillsTriggerHit(e.object)) {
      e.stopPropagation();
      triggerSkillsStep();
    }
  };

  const handleClick = (e) => {
    if (blockToggleUntilPointerUpRef.current) {
      e.stopPropagation();
      return;
    }
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      e.stopPropagation();
      return;
    }
    toggle();
  };

  const handlePointerUp = () => {
    blockToggleUntilPointerUpRef.current = false;
  };

  useEffect(() => {
    if (!isInMeetPortal) return undefined;

    window.__prepareControlledGLBEntry = (meshName) => {
      const lower = String(meshName || "").toLowerCase().trim();
      const activeAction = getAction();
      if (!activeAction) return false;

      console.log("🧼 Preparing ControlledGLB entry for:", lower || "(none)");

      controlledSequenceIdRef.current += 1;
      controlledSequenceStateRef.current = null;
      controlledSequenceContinueRef.current = null;
      rewindingRef.current = false;
      forwardPlayingRef.current = false;
      goalStopTimeRef.current = null;
      pendingSkillsAdvanceRef.current = false;
      skillsAdvanceCompletedRef.current = false;
      skillsClickedRef.current = false;
      suppressNextClickRef.current = false;
      blockToggleUntilPointerUpRef.current = false;
      activeAction.reset();
      activeAction.paused = true;
      syncSkillsVisuals(false);
      syncBack1Visuals(false);
      if (lower === "skills" || lower === "discover" || lower === "vibe") {
        if (lower === "vibe") {
          setCurrentMeshContext(lower, { stage: "ascend_opening" });
        } else if (lower === "discover") {
          setCurrentMeshContext(lower, { stage: "ascend_opening" });
        } else if (lower === "skills") {
          setCurrentMeshContext(lower, { stage: "skills" });
        } else {
          setCurrentMeshContext(lower);
        }
      } else {
        setCurrentMeshContext("vibe", { stage: "ascend_opening" });
      }
      mixer.update(0);
      return true;
    };

    return () => {
      if (window.__prepareControlledGLBEntry) {
        delete window.__prepareControlledGLBEntry;
      }
    };
  }, [getAction, isInMeetPortal, mixer, syncBack1Visuals, syncSkillsVisuals]);

  useEffect(() => {
    window.__triggerControlledGLB = (meshName) => {
      if (!scene) return false;
      const lower = meshName.toLowerCase();
      console.log("🎙️ Voice trigger ->", lower);

      if (lower === "vibe") {
        if (!triggerVibeStep()) return false;
        console.log("🎙️ Voice -> direct Vibe step");
        return true;
      }

      if (lower === "discover") {
        if (!triggerDiscoverStep()) return false;
        console.log("🎙️ Voice -> direct Discover step");
        return true;
      }

      if (lower === "skills") {
        if (!triggerSkillsStep()) return false;
        console.log("🎙️ Voice -> direct Skills step");
        return true;
      }

      const findTriggerTarget = (predicate) => {
        let found = null;
        scene.traverse((o) => {
          if (found || !o) return;
          if (predicate(o)) found = o;
        });
        return found;
      };

      let target = null;
      if (lower === "vibe") {
        target = findTriggerTarget((o) => isHitNamed(o, "Vibe"));
      } else if (lower === "discover") {
        target = findTriggerTarget((o) => isDiscoverTriggerHit(o));
      } else if (lower === "skills") {
        target = findTriggerTarget((o) => isSkillsTriggerHit(o));
      } else {
        target =
          scene.getObjectByName(meshName) ||
          findTriggerTarget((o) =>
            (o.name || "").toLowerCase().includes(lower)
          );
      }

      if (!target) {
        console.warn("⚠️ No mesh found matching", meshName);
        return false;
      }

      console.log("🎯 Voice resolved target:", target.name || "(unnamed)");

      if (lower.includes("vibe")) {
        setCurrentMeshContext("vibe", { stage: "ascend_opening" });
      } else if (lower.includes("discover")) {
        setCurrentMeshContext("discover", { stage: "ascend_opening" });
      } else if (lower.includes("skills")) {
        setCurrentMeshContext("skills", { stage: "skills" });
      }
      console.log("🎙️ Voice -> set currentMesh =", window.__currentMesh);

      const fakeEvent = { object: target, stopPropagation: () => {} };
      handlePointerDown(fakeEvent);
      return true;
    };

    return () => delete window.__triggerControlledGLB;
  }, [scene, handlePointerDown, triggerDiscoverStep, triggerSkillsStep, triggerVibeStep]);

  useEffect(() => {
    window.__triggerControlledGLBSequence = (steps) => {
      if (!scene) return false;
      return triggerControlledClickSequence(steps);
    };

    return () => delete window.__triggerControlledGLBSequence;
  }, [scene, triggerControlledClickSequence]);

  useEffect(() => {
    window.__voiceBackControlledGLB = () => {
      console.log("🎙️ Voice -> Rewind FULL to frame 0");
      return triggerBackSequence(onBackClick);
    };
    return () => delete window.__voiceBackControlledGLB;
  }, [onBackClick, triggerBackSequence]);

  useEffect(() => {
    window.__voiceBack1ControlledGLB = () => {
      console.log("🎙️ Voice -> Rewind Back1 to Vibe stop");
      onBack1Click?.();
      return triggerBack1Sequence();
    };
    return () => delete window.__voiceBack1ControlledGLB;
  }, [onBack1Click, triggerBack1Sequence]);

  useEffect(() => {
    window.__voiceVibeControlledGLB = () => {
      const stopTime = VIBE_REWIND_HOLD_F / fps;
      console.log("🎙️ Voice -> Rewind to Vibe stop", stopTime, "sec");
      forwardPlayingRef.current = false;
      goalStopTimeRef.current = null;
      startRewindTo(stopTime, undefined, {
        speed: BACK1_REWIND_SPEED,
        minFactor: BACK1_REWIND_MIN_FACTOR,
        easePower: BACK1_REWIND_EASE_POWER,
        easeStartAt: BACK1_REWIND_EASE_START_F / fps,
      });
    };
    return () => delete window.__voiceVibeControlledGLB;
  }, [
    startRewindTo,
    fps,
    VIBE_REWIND_HOLD_F,
    BACK1_REWIND_SPEED,
    BACK1_REWIND_MIN_FACTOR,
    BACK1_REWIND_EASE_POWER,
    BACK1_REWIND_EASE_START_F,
  ]);

  useEffect(() => {
    window.__voiceRestartVibeControlledGLB = () => {
      console.log("🎙️ Voice -> Restart Flex from beginning");
      return restartVibeFromBeginning();
    };
    return () => delete window.__voiceRestartVibeControlledGLB;
  }, [restartVibeFromBeginning]);

  useEffect(() => {
    window.__voiceReturnVibeControlledGLB = () => {
      console.log("🎙️ Voice -> Return Flex to rest frame");
      return returnVibeToRestFrame();
    };
    return () => delete window.__voiceReturnVibeControlledGLB;
  }, [returnVibeToRestFrame]);

  useEffect(() => {
    window.__voiceSkillsToVibeControlledGLB = () => {
      const action = getAction();
      if (!action) return false;

      console.log("🎙️ Voice -> Rewind Skills to Ascend, then to Flex");
      onBack1Click?.();
      return triggerBack1Sequence(() => {
        returnVibeToRestFrame();
      });
    };
    return () => delete window.__voiceSkillsToVibeControlledGLB;
  }, [getAction, onBack1Click, returnVibeToRestFrame, triggerBack1Sequence]);

  useEffect(() => {
    window.__voiceDiscoverControlledGLB = () => {
      const stopTime = DISCOVER_REWIND_HOLD_F / fps;
      console.log("🎙️ Voice -> Rewind to Discover stop", stopTime, "sec");
      forwardPlayingRef.current = false;
      goalStopTimeRef.current = null;
      startRewindTo(stopTime);
    };
    return () => delete window.__voiceDiscoverControlledGLB;
  }, [startRewindTo, fps, DISCOVER_REWIND_HOLD_F]);

  useFrame(() => {
    if (!isInMeetPortal || !isActive) return;

    const action = getAction();
    if (!action) return;

    const time = action.time * fps;
    const frameState = getMeetJozFrameState(time);
    const rewindStage = rewindingRef.current
      ? getMeetJozRewindStage(rewindTargetRef.current * fps)
      : null;
    const effectiveFrameState = rewindStage
      ? { ...frameState, stage: rewindStage }
      : frameState;
    const isDiscoverActive =
      isActive && effectiveFrameState.mesh === "discover";
    const metaballsProgress = THREE.MathUtils.clamp((time - 106) / 24, 0, 1);
    const shouldShowMetaballs = metaballsProgress > 0.001;

    if (
      typeof onDiscoverActiveChange === "function" &&
      lastDiscoverActiveRef.current !== isDiscoverActive
    ) {
      lastDiscoverActiveRef.current = isDiscoverActive;
      onDiscoverActiveChange(isDiscoverActive);
    }

    if (
      typeof onMetaballsVisibleChange === "function" &&
      lastMetaballsVisibleRef.current !== shouldShowMetaballs
    ) {
      lastMetaballsVisibleRef.current = shouldShowMetaballs;
      onMetaballsVisibleChange(shouldShowMetaballs);
    }

    if (
      typeof onMetaballsProgressChange === "function" &&
      (lastMetaballsProgressRef.current === null ||
        Math.abs(lastMetaballsProgressRef.current - metaballsProgress) > 0.01)
    ) {
      lastMetaballsProgressRef.current = metaballsProgress;
      onMetaballsProgressChange(metaballsProgress);
    }

    const newContext = effectiveFrameState.mesh;

    if (
      newContext &&
      (window.__currentMesh !== newContext ||
        (window.__currentMeshStage || null) !==
          (effectiveFrameState.stage || null))
    ) {
      setCurrentMeshContext(newContext, { stage: effectiveFrameState.stage });
      console.log(
        `🧭 Auto context -> ${newContext}/${effectiveFrameState.stage} (frame ${time.toFixed(1)})`
      );
    }
  });

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return undefined;
    if (!isInMeetPortal || !isActive) return undefined;

    const id = setInterval(() => {
      const action = getAction();
      if (!action) return;

      const time = action.time * fps;
      const paused = action.paused;

      if (paused && time > Vibe_STOP_F + 0.1 && time <= DISC_STOP_AT) {
        if (window.__currentMesh !== "discover") {
          setCurrentMeshContext("discover");
          console.log(
            "🧭 Forced context correction -> discover (paused at frame)",
            time.toFixed(1)
          );
        }
      }

      if (paused && time > DISC_STOP_AT + 0.1) {
        if (window.__currentMesh !== "skills") {
          setCurrentMeshContext("skills");
          console.log(
            "🧭 Forced context correction -> skills (paused at frame)",
            time.toFixed(1)
          );
        }
      }
    }, 300);

    return () => clearInterval(id);
  }, [getAction, fps, isActive, isInMeetPortal, Vibe_STOP_F, DISC_STOP_AT]);

  useEffect(() => {
    return () => {
      onDiscoverActiveChange?.(false);
      onMetaballsVisibleChange?.(false);
      onMetaballsProgressChange?.(0);
    };
  }, [
    onDiscoverActiveChange,
    onMetaballsProgressChange,
    onMetaballsVisibleChange,
  ]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return undefined;
    if (!scene || portalId !== "meet-joz") return;

    const publish = () => {
      const activeAction = getAction();
      publishPortalSceneDebug(
        "meet-joz",
        "ControlledGLB",
        summarizeSceneGraph(scene, {
          animationNames: names || [],
          interactiveHints: [
            "vibe",
            "discover",
            "gg",
            "skills",
            "mogg",
            "mogg1",
            "back",
            "back1",
            "armature",
            "00x",
          ],
          state: {
            active: isActive,
            currentClip: current,
            currentTime: Number((activeAction?.time || 0).toFixed(3)),
            currentFrame: Number(((activeAction?.time || 0) * fps).toFixed(1)),
            rewinding: rewindingRef.current,
            forwardPlaying: forwardPlayingRef.current,
            workStepBlocking,
            workStepVisible: isWorkStepVisible,
            workStepActive: isWorkStepActive,
            currentMesh:
              typeof window !== "undefined" ? window.__currentMesh || null : null,
          },
        })
      );
    };

    publish();
    const intervalId = window.setInterval(publish, 500);
    return () => window.clearInterval(intervalId);
  }, [
    current,
    fps,
    isActive,
    isWorkStepActive,
    isWorkStepVisible,
    names,
    portalId,
    scene,
    workStepBlocking,
    getAction,
  ]);

  return (
    <group
      ref={group}
      position={[0, 0, -2]}
      scale={[0.014, 0.014, 0.014]}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
    >
      <primitive object={scene} />
    </group>
  );
}
