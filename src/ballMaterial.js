import * as THREE from 'three';

function createShinyGoldMaterial(baseMaterial) {
  const material = baseMaterial.clone();
  material.color = new THREE.Color('#f4c84a');
  material.emissive = new THREE.Color('#7a4f00');
  material.emissiveIntensity = 0.38;
  material.metalness = 1;
  material.roughness = 0.14;
  material.reflectivity = 1;
  material.clearcoat = 1;
  material.clearcoatRoughness = 0.12;
  material.envMapIntensity = 1.45;
  material.specularIntensity = 1;
  material.specularColor = new THREE.Color('#ffe08a');
  material.toneMapped = true;
  material.needsUpdate = true;
  return material;
}

export function applyBallGoldMaterial(scene) {
  if (!scene) return;

  scene.traverse((object) => {
    if (!object.isMesh) return;

    if (object.name === 'Roundcube' && Array.isArray(object.material)) {
      object.material = object.material.map((material) => {
        if (material?.name === 'pill-mat') {
          const goldMaterial = createShinyGoldMaterial(material);
          goldMaterial.name = 'pill-mat';
          return goldMaterial;
        }

        return material;
      });
      return;
    }

    if (object.material?.name === 'pill-mat') {
      const goldMaterial = createShinyGoldMaterial(object.material);
      goldMaterial.name = 'pill-mat';
      object.material = goldMaterial;
    }
  });
}
