import React, { useEffect, useState } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const GLBPreloader = ({ glbUrls }) => {
  const [loadedModels, setLoadedModels] = useState([]);

  useEffect(() => {
    const loader = new GLTFLoader();
    const loaded = [];

    glbUrls.forEach((url) => {
      loader.load(
        url,
        (gltf) => {
          console.log(`Loaded ${url}`);
          loaded.push({ url, size: gltf.scene });
          if (loaded.length === glbUrls.length) {
            setLoadedModels(loaded);
          }
        },
        undefined,
        (error) => {
          console.error(`Error loading ${url}:`, error);
        }
      );
    });
  }, [glbUrls]);

  useEffect(() => {
    if (loadedModels.length === glbUrls.length) {
      loadedModels.forEach((model) => {
        const size = JSON.stringify(model.size).length;
        console.log(`Model: ${model.url}, Size: ${size} bytes`);
      });
    }
  }, [loadedModels, glbUrls.length]);

  return null;
};

export default GLBPreloader;
