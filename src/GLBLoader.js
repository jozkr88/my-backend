import React, { useEffect, useState } from 'react';
import { useGLTF } from '@react-three/drei';

const GLBLoader = ({ url }) => {
  const [progress, setProgress] = useState(0);
  const { nodes, materials } = useGLTF(url);

  useEffect(() => {
    const loader = new THREE.GLTFLoader();

    loader.load(
      url,
      (gltf) => {
        // GLB loaded successfully
        console.log('GLB loaded:', gltf);

        // Example: Dispatch an event or update state indicating loading is complete
        // dispatchEvent(new CustomEvent('gltf-loaded', { detail: gltf }));

        // For demonstration purposes, set progress to 100% after a brief delay
        setTimeout(() => setProgress(100), 500);
      },
      (xhr) => {
        // Progress callback
        const percentLoaded = (xhr.loaded / xhr.total) * 100;
        setProgress(percentLoaded);
      },
      (error) => {
        // Error callback
        console.error('Error loading GLB:', error);
      }
    );

    // Clean up function
    return () => {
      loader.dispose();
    };
  }, [url]);

  return (
    <div>
      <p>Loading {url}</p>
      <progress value={progress} max={100} />
      <p>{Math.round(progress)}%</p>
    </div>
  );
};

export default GLBLoader;
