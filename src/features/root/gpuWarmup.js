import { Suspense, useEffect, useMemo } from "react";

import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";

import { assetUrl } from "../../utils/paths";

export const DESKTOP_ONLY_MODELS = [
  "/worldx.glb",
  "/worldx-m.glb",
].map(assetUrl);

export const ROOT_WARMUP_MODELS = [
  "/enter.glb",
  "/bx.glb",
  "/ball.glb",
  "/aura.glb",
].map(assetUrl);

const PORTAL_WARMUP_MODELS = {
  root: ROOT_WARMUP_MODELS,
  maxx: [
    ...ROOT_WARMUP_MODELS,
    assetUrl("/n3.glb"),
    assetUrl("/n2x.glb"),
    assetUrl("/neurodesign.glb"),
  ],
  "meet-joz": [
    ...ROOT_WARMUP_MODELS,
    assetUrl("/model1.glb"),
    assetUrl("/workf.glb"),
    assetUrl("/aurx.glb"),
    assetUrl("/jkx-d.glb"),
    assetUrl("/glassx.glb"),
    assetUrl("/worldx.glb"),
  ],
};

export const PORTAL_PRELOAD_MODELS = {
  root: ROOT_WARMUP_MODELS,
  maxx: [
    ...ROOT_WARMUP_MODELS,
    assetUrl("/n3.glb"),
    assetUrl("/n2x.glb"),
    assetUrl("/n2x-m.glb"),
    assetUrl("/neurodesign.glb"),
    assetUrl("/neurodesign-m.glb"),
  ],
  "meet-joz": [
    ...ROOT_WARMUP_MODELS,
    assetUrl("/model1.glb"),
    assetUrl("/workf.glb"),
    assetUrl("/workf-m.glb"),
    assetUrl("/aurx.glb"),
    assetUrl("/jkx-d.glb"),
    assetUrl("/jkx-m.glb"),
    assetUrl("/glassx.glb"),
    assetUrl("/chat.glb"),
    assetUrl("/ascend.glb"),
  ],
};

export function GpuWarmup({ portalKey = "root" }) {
  const { gl, camera, scene } = useThree();
  const warmupModels = useMemo(
    () => PORTAL_WARMUP_MODELS[portalKey] || ROOT_WARMUP_MODELS,
    [portalKey]
  );

  useEffect(() => {
    gl.compile(scene, camera);
  }, [camera, gl, scene]);

  return (
    <Suspense fallback={null}>
      <group visible={false}>
        {warmupModels.map((path) => {
          const { scene: modelScene } = useGLTF(path);
          return <primitive key={path} object={modelScene.clone()} />;
        })}
      </group>
    </Suspense>
  );
}
