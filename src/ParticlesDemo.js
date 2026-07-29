import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const Particle = ({ position }) => {
  const ref = useRef();
  const speed = 0.02;

  useFrame(() => {
    if (ref.current.position.y > -5) {
      ref.current.position.y -= speed;
    } else {
      ref.current.position.y = Math.random() * 5 + 5; // Reset position to the top
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereBufferGeometry args={[0.1, 32, 32]} />
      <meshStandardMaterial color={'#ffffff'} />
    </mesh>
  );
};

const Particles = ({ count }) => {
  const particles = useRef([]);

  useEffect(() => {
    particles.current = Array.from({ length: count }, (_, i) => ({
      id: i,
      position: [Math.random() * 6 - 3, Math.random() * 5 + 5, Math.random() * 6 - 3],
    }));
  }, [count]);

  return (
    <>
      {particles.current.map(particle => (
        <Particle
          key={particle.id}
          position={particle.position}
        />
      ))}
    </>
  );
};

const ParticleCanvas = () => {
  return (
    <Canvas
      style={{ width: '100vw', height: '100vh' }}
      camera={{ position: [0, 0, 10], fov: 60 }}
    >
      <ambientLight />
      <pointLight position={[10, 10, 10]} />
      <Particles count={100} />
    </Canvas>
  );
};

export default ParticleCanvas;
