import * as THREE from "three";

import { useLayoutEffect, useMemo } from "react";
import { Center, useGLTF } from "@react-three/drei";

import { assetUrl } from "../../utils/paths";

function VibeWord({ scale = 1 }) {
  const { scene } = useGLTF(assetUrl("/ascend.glb"));
  const model = useMemo(() => scene.clone(true), [scene]);

  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "white",
        roughness: 0.03,
        transmission: 1,
        ior: 1.8,
        thickness: 1,
        reflectivity: 0.3,
        clearcoat: 0.2,
        clearcoatRoughness: 0.1,
        iridescence: 1,
        iridescenceIOR: 0.9,
      }),
    []
  );

  useLayoutEffect(() => {
    material.iridescenceThicknessRange = [233, 434];
  }, [material]);

  useLayoutEffect(() => {
    model.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.material = material;
      obj.castShadow = true;
      obj.receiveShadow = true;
    });
  }, [model, material]);

  const handleClick = (e) => {
    e.stopPropagation();
    window.location.href = "mailto:joz@meetjoz.com";
  };

  return (
    <Center position={[0, 0, 2]} rotation={[0, Math.PI, 0]}>
      <primitive
        object={model}
        scale={Array.isArray(scale) ? scale : [scale, scale, scale]}
        onClick={handleClick}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      />
    </Center>
  );
}

export { VibeWord };
