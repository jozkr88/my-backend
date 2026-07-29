import * as THREE from "three";

export function twoPassGlass(obj) {
  obj.traverse((o) => {
    if (o.isMesh && o.material && !o.userData.isBackface) {
      // --- Back faces ---
      const back = o.material.clone();
      back.side = THREE.BackSide;
      back.depthWrite = false;
      back.transparent = true;
      back.depthFunc = THREE.LessEqualDepth;
      back.renderOrder = 0;

      const backMesh = new THREE.Mesh(o.geometry, back);
      backMesh.userData.isBackface = true; // mark it
      backMesh.renderOrder = 0;

      // --- Front faces ---
      o.material.side = THREE.FrontSide;
      o.material.depthWrite = false;
      o.material.transparent = true;
      o.material.depthFunc = THREE.LessEqualDepth;
      o.material.renderOrder = 1;

      o.add(backMesh);
    }
  });
}
