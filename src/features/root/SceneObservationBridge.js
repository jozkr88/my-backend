import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

import { isWorldModelShadowEnabled } from "../../world-model/mode";

const MAX_SCENE_OBJECTS = 200;

function vectorValues(vector) {
  return vector ? [vector.x, vector.y, vector.z] : null;
}

function objectId(object) {
  return String(
    object?.userData?.entityId ||
    object?.userData?.objectId ||
    object?.userData?.meshId ||
    object?.name ||
    ""
  ).trim().toLowerCase();
}

export function SceneObservationBridge({ currentPortal, currentStage, currentMesh }) {
  const { scene, camera, gl } = useThree();

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (!isWorldModelShadowEnabled()) {
      window.__sceneObservationSnapshot = null;
      return undefined;
    }

    try {
      const visibleObjectIds = [];
      const visibleMeshIds = [];
      const objectTransforms = [];
      const parentChildRelations = [];

      scene.traverse((object) => {
        if (visibleObjectIds.length >= MAX_SCENE_OBJECTS || !object?.visible) return;
        const id = objectId(object);
        if (!id) return;
        visibleObjectIds.push(id);
        if (object.isMesh) visibleMeshIds.push(id);
        if (object.position && object.rotation && object.scale) {
          objectTransforms.push({
            id,
            position: vectorValues(object.position),
            rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
            scale: vectorValues(object.scale),
            parentId: objectId(object.parent) || null,
          });
        }
        const parentId = objectId(object.parent);
        if (parentId) parentChildRelations.push({ subject: id, relation: "child-of", object: parentId });
      });

      const viewportWidth = gl?.domElement?.clientWidth || gl?.domElement?.width || null;
      const viewportHeight = gl?.domElement?.clientHeight || gl?.domElement?.height || null;
      const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const snapshot = {
        sceneState: {
          sceneId: currentPortal || "root",
          activePortal: currentPortal || "root",
          activeStage: currentStage || null,
          focusedEntityId: currentMesh || null,
          visibleObjectIds,
          visibleMeshIds,
          objectTransforms,
          parentChildRelations,
          animationState: currentStage || null,
        },
        cameraState: {
          position: vectorValues(camera.position),
          direction: vectorValues(cameraDirection),
          projection: {
            type: camera.isPerspectiveCamera ? "perspective" : camera.isOrthographicCamera ? "orthographic" : "unknown",
            fov: camera.fov,
            aspect: camera.aspect,
            near: camera.near,
            far: camera.far,
          },
          viewport: {
            width: viewportWidth,
            height: viewportHeight,
            pixelRatio: typeof gl?.getPixelRatio === "function" ? gl.getPixelRatio() : null,
          },
        },
        runtimeStatus: {
          renderer: "react-three-fiber",
          viewportWidth,
          viewportHeight,
          loading: false,
          animating: Boolean(currentStage),
        },
        spatialRelationships: parentChildRelations,
        sourceVersions: { renderer: "react-three-fiber-structured-v1" },
      };
      window.__sceneObservationSnapshot = snapshot;
      window.dispatchEvent(new CustomEvent("world-scene-observed", { detail: snapshot }));
    } catch (error) {
      window.__sceneObservationFailure = {
        message: String(error?.message || error),
        recordedAt: new Date().toISOString(),
      };
    }

    return undefined;
  }, [camera, currentMesh, currentPortal, currentStage, gl, scene]);

  return null;
}
