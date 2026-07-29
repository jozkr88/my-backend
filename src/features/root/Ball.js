import * as THREE from "three";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

import { SkeletonUtils } from "three-stdlib";

import { applyBallGoldMaterial } from "../../ballMaterial";
import { assetUrl } from "../../utils/paths";

export function Ball({
  onLoad,
  onActivate,
  position = [0, -2.3, 0],
  scale = 1.5,
  opacityTarget = 1,
  opacityTargetRef = null,
}) {
  const FADE_DAMPING = 3.4;
  const VISUAL_OPACITY_GAMMA = 0.68;
  const MIN_SCALE_DURING_FADE = 0.58;
  const SCALE_PULSE = 0.12;
  const usesAnimatedOpacityRef = opacityTargetRef !== null;
  const groupRef = useRef();
  const animatedScaleRef = useRef();
  const contentRef = useRef();
  const { scene: sourceScene } = useGLTF(assetUrl("/ball.glb"));
  const scene = useMemo(
    () => (sourceScene ? SkeletonUtils.clone(sourceScene) : null),
    [sourceScene]
  );

  const getOpacityTarget = () =>
    THREE.MathUtils.clamp(opacityTargetRef?.current ?? opacityTarget, 0, 1);
  const fadeOpacity = useRef(getOpacityTarget());
  const activateBall = (event) => {
    event?.stopPropagation?.();
    onActivate?.();
  };

  const syncOpacity = (opacity) => {
    const visualOpacity =
      opacity <= 0
        ? 0
        : THREE.MathUtils.clamp(
            Math.pow(opacity, VISUAL_OPACITY_GAMMA),
            0,
            1
          );
    const scaleCurve = visualOpacity * visualOpacity * (3 - 2 * visualOpacity);
    const scalePulse = Math.sin(scaleCurve * Math.PI) * SCALE_PULSE;
    const scaleMultiplier =
      THREE.MathUtils.lerp(MIN_SCALE_DURING_FADE, 1, scaleCurve) + scalePulse;

    if (groupRef.current) {
      groupRef.current.visible = visualOpacity > 0.0005;
    }

    if (animatedScaleRef.current) {
      if (Array.isArray(scale)) {
        animatedScaleRef.current.scale.set(
          scale[0] * scaleMultiplier,
          scale[1] * scaleMultiplier,
          scale[2] * scaleMultiplier
        );
      } else {
        animatedScaleRef.current.scale.setScalar(scale * scaleMultiplier);
      }
    }

    if (!scene) return;

    scene.traverse((object) => {
      if (!object.isMesh || !object.material) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => {
        if (!material) return;
        const baseOpacity =
          material.userData.ballBaseOpacity ?? material.opacity ?? 1;
        material.opacity = baseOpacity * visualOpacity;
      });
    });
  };

  useLayoutEffect(() => {
    if (!scene) return;
    applyBallGoldMaterial(scene);

    scene.traverse((object) => {
      if (!object.isMesh || !object.material) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => {
        if (!material) return;
        if (material.userData.ballBaseOpacity === undefined) {
          material.userData.ballBaseOpacity = material.opacity ?? 1;
        }
        material.transparent = true;
        material.depthWrite = false;
        material.needsUpdate = true;
      });
    });

    syncOpacity(fadeOpacity.current);
  }, [scene]);

  useLayoutEffect(() => {
    fadeOpacity.current = getOpacityTarget();
    syncOpacity(fadeOpacity.current);
  }, [scene, opacityTarget, opacityTargetRef]);

  useEffect(() => {
    if (!scene || typeof onLoad !== "function") return;
    onLoad({ scene });
  }, [onLoad, scene]);

  useFrame((_, dt) => {
    if (!scene) return;

    const target = getOpacityTarget();
    fadeOpacity.current = usesAnimatedOpacityRef
      ? target
      : THREE.MathUtils.damp(fadeOpacity.current, target, FADE_DAMPING, dt);
    syncOpacity(fadeOpacity.current);
  });

  useEffect(() => {
    if (!scene) return undefined;

    const exportBallPng = ({
      filename = "ball-brand.png",
      width = 2200,
      height = 1400,
      pixelRatio = 1,
    } = {}) => {
      const exportRenderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });

      exportRenderer.setPixelRatio(pixelRatio);
      exportRenderer.setSize(width, height, false);
      exportRenderer.outputColorSpace = THREE.SRGBColorSpace;
      exportRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      exportRenderer.toneMappingExposure = 1.1;
      exportRenderer.setClearColor(0x000000, 0);

      const exportScene = new THREE.Scene();
      const exportCamera = new THREE.PerspectiveCamera(
        24,
        width / height,
        0.01,
        100
      );
      const exportBall = SkeletonUtils.clone(scene);

      exportBall.rotation.set(Math.PI / 2, 0, 0);
      exportScene.add(exportBall);

      exportScene.add(new THREE.AmbientLight(0xffffff, 2.4));

      const keyLight = new THREE.DirectionalLight(0xfff1c2, 4.8);
      keyLight.position.set(3.5, 2.4, 5.5);
      exportScene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xffcf6b, 2.6);
      fillLight.position.set(-4.2, -0.6, 3.6);
      exportScene.add(fillLight);

      const rimLight = new THREE.DirectionalLight(0xffffff, 1.8);
      rimLight.position.set(-2.8, 1.8, -4.4);
      exportScene.add(rimLight);

      const bounds = new THREE.Box3().setFromObject(exportBall);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = THREE.MathUtils.degToRad(exportCamera.fov);
      const distance = (maxDim * 0.72) / Math.tan(fov / 2);

      exportCamera.position.set(center.x, center.y, center.z + distance * 1.45);
      exportCamera.lookAt(center);
      exportCamera.near = 0.01;
      exportCamera.far = distance * 10;
      exportCamera.updateProjectionMatrix();

      exportRenderer.render(exportScene, exportCamera);

      const link = document.createElement("a");
      link.download = filename;
      link.href = exportRenderer.domElement.toDataURL("image/png");
      link.click();

      exportBall.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.geometry?.dispose?.();
      });
      exportRenderer.dispose();
    };

    window.exportBallPng = exportBallPng;
    window.__exportBallPng = exportBallPng;

    return () => {
      delete window.exportBallPng;
      delete window.__exportBallPng;
    };
  }, [scene]);

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerDown={activateBall}
      onClick={activateBall}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      <group ref={animatedScaleRef}>
        <mesh onPointerDown={activateBall} onClick={activateBall}>
          <sphereGeometry args={[0.82, 32, 32]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <group ref={contentRef} rotation={[Math.PI / 2, 0, 0]}>
          <primitive object={scene} />
        </group>
      </group>
    </group>
  );
}
