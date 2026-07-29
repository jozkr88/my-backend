import React, { useState, useMemo, useEffect, useRef } from "react";
import { useThree, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";

const Cube = () => {
  const { gl } = useThree();
  const meshRef = useRef();

  const texture = useLoader(RGBELoader, "/hdr.hdr");
  const pmremGenerator = new THREE.PMREMGenerator(gl);
  pmremGenerator.compileEquirectangularShader();

  const envMap = pmremGenerator.fromEquirectangular(texture).texture;
  envMap.encoding = THREE.LinearEncoding;
  envMap.mapping = THREE.EquirectangularReflectionMapping;

  useEffect(() => {
    const animate = () => {
      // Rotate the cube in each animation frame
      meshRef.current.rotation.x += 0.005;
      meshRef.current.rotation.y += 0.005;

      // Request the next frame
      requestAnimationFrame(animate);
    };

    // Start the animation loop
    animate();
  }, []);

  return (
    <group>
      {envMap && (
        <mesh>
          <sphereGeometry args={[20, 20, 20, 20]} />
          <meshStandardMaterial
            attach="material"
            side={THREE.BackSide}
            envMap={envMap}
            map={texture}
            needsUpdate={true}
          />
        </mesh>
      )}
      <mesh ref={meshRef}>
        
        <meshStandardMaterial attach="material" envMap={envMap} />
      </mesh>
    </group>
  );
};

export default Cube;
