import * as THREE from "three";

import { memo, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import { useRoute } from "wouter";

export const Rig = memo(function Rig({ disableInteraction = false }) {
  const { controls, scene } = useThree();
  const [, params] = useRoute("/neo/:id");
  const portalId = params?.id ?? null;
  const positionRef = useRef(new THREE.Vector3(0, 0, 2));
  const focusRef = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (!controls) return;

    const position = positionRef.current;
    const focus = focusRef.current;
    controls.minDistance = 1.5;
    controls.maxDistance = 5;
    controls.enableRotate = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = false;
    controls.maxPolarAngle = Math.PI / 2;

    const active = portalId ? scene.getObjectByName(portalId) : null;

    if (active?.parent) {
      const cameraOffsetZ = portalId === "meet-joz"
        ? 0.08
        : 0.291;
      active.parent.localToWorld(position.set(0, 0, cameraOffsetZ));
      active.parent.localToWorld(focus.set(0, 0, -2));
    } else {
      position.set(0, 0, 2);
      focus.set(0, 0, 0);
    }

    controls.setLookAt(...position.toArray(), ...focus.toArray(), true);
  }, [controls, portalId, scene]);

  useEffect(() => {
    if (!controls) return;
    controls.enabled = !disableInteraction;
    return () => {
      controls.enabled = true;
    };
  }, [controls, disableInteraction]);

  return (
    <CameraControls
      makeDefault
      minPolarAngle={0}
      maxPolarAngle={Math.PI / 2}
    />
  );
});
