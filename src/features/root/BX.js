import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useCursor, useGLTF } from "@react-three/drei";
import { useLocation } from "wouter";

import { APP_ACTIONS } from "../../state/actionTypes";
import { assetUrl } from "../../utils/paths";

export function BX({
  portalRef,
  stabilizePortalAlphaMaterial,
  onSpeak,
  ...props
}) {
  const ref = useRef();
  const [, setLocation] = useLocation();
  const [hovered, setHovered] = useState(false);
  useCursor(hovered, "pointer");

  const { scene: bxScene } = useGLTF(assetUrl("/bx.glb"));
  const clonedScene = useMemo(() => bxScene.clone(), [bxScene]);

  useEffect(() => {
    if (!clonedScene) return;
    clonedScene.traverse((obj) => {
      if (obj.isMesh) {
        obj.userData = {
          action: "portal",
          commands: ["enter", "go inside", "open portal"],
        };
      }
    });
  }, [clonedScene]);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const root = ref.current;

    const targets = [];
    root.traverse((o) => {
      if ((o.isMesh || o.isSkinnedMesh) && o.name === "uu.007") targets.push(o);
    });

    if (targets.length === 0) {
      return;
    }

    targets.forEach((mesh) => {
      mesh.visible = false;
      mesh.parent?.remove(mesh);
      mesh.geometry?.dispose?.();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => m?.dispose?.());
    });
  }, [clonedScene]);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const root = ref.current;

    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];

      mats.forEach((m) => {
        if (m && m.name === "dd.001") {
          m.transparent = true;
          m.opacity = 0;
          m.colorWrite = false;
          m.depthWrite = false;
          m.depthTest = true;
          m.premultipliedAlpha = true;
          m.needsUpdate = true;
        }
      });
    });
  }, [clonedScene]);

  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.traverse((o) => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (m.alphaMap || m.transparent || m.opacity < 1 || m.transmission > 0) {
            stabilizePortalAlphaMaterial(m);
            o.renderOrder = 999;
            if (m.userData.baseOpacity === undefined) m.userData.baseOpacity = m.opacity;
          }
          if (m.name === "uu.002") m.color.multiplyScalar(0.2);
        });
      }
    });
  }, [clonedScene, stabilizePortalAlphaMaterial]);

  useFrame(() => {
    if (!ref.current || !portalRef?.current) return;
    const blend = portalRef.current.blend;
    ref.current.traverse((o) => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (m.userData.baseOpacity !== undefined) {
            m.opacity = m.userData.baseOpacity * blend;
          }
        });
      }
    });
  });

  if (!clonedScene) return null;

  return (
    <primitive
      ref={ref}
      object={clonedScene}
      scale={1.6}
      position={[0, 0.14, 0]}
      rotation={[0.1, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        const handled = window.__dispatchAppAction?.(APP_ACTIONS.NAVIGATE, {
          targetPath: "/neo/maxx",
        });
        if (!handled) {
          setLocation("/neo/maxx");
        }
        onSpeak?.("");
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      {...props}
    />
  );
}
