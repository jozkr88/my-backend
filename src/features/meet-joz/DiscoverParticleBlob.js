import * as THREE from "three";

import { useMemo, useRef } from "react";
import { extend, useFrame } from "@react-three/fiber";
import { Float, shaderMaterial } from "@react-three/drei";
import { useARSupport } from "../../hooks/useARSupport";

const DiscoverBlobParticleMaterial = shaderMaterial(
  {
    uTime: 0,
    uOpacity: 0,
    uSize: 58,
  },
  `
    attribute float aScale;
    attribute float aPhase;

    uniform float uTime;
    uniform float uOpacity;
    uniform float uSize;

    varying float vStrength;

    void main() {
      vec3 transformed = position;
      float wave =
        sin(uTime * 1.1 + aPhase * 6.28318) * 0.11 +
        sin(uTime * 1.7 + position.y * 7.0) * 0.06;
      transformed += normalize(position) * wave * uOpacity;

      vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      float depthScale = 1.0 / max(0.25, -mvPosition.z);
      gl_PointSize = uSize * aScale * depthScale;
      vStrength = (0.55 + wave * 1.8) * uOpacity;
    }
  `,
  `
    varying float vStrength;

    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float dist = length(uv);
      float alpha = smoothstep(0.5, 0.08, dist) * vStrength;

      vec3 inner = vec3(0.78, 0.97, 1.0);
      vec3 mid = vec3(0.26, 0.88, 1.0);
      vec3 outer = vec3(0.08, 0.24, 0.55);
      vec3 color = mix(outer, mid, smoothstep(0.48, 0.12, dist));
      color = mix(color, inner, smoothstep(0.18, 0.0, dist));

      gl_FragColor = vec4(color, alpha);
    }
  `
);

extend({ DiscoverBlobParticleMaterial });

export function DiscoverParticleBlob({
  active,
  portalBlend = 1,
  position = [0, 0.04, -2],
}) {
  const { isMobile } = useARSupport();
  const groupRef = useRef();
  const materialRef = useRef();
  const opacityRef = useRef(0);
  const progressRef = useRef(0);
  const pointSizeMultiplier = isMobile ? 0.8 : 1;

  const [positions, scales, phases] = useMemo(() => {
    const count = 100;
    const pos = new Float32Array(count * 3);
    const scale = new Float32Array(count);
    const phase = new Float32Array(count);
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;

    for (let i = 0; i < count; i += 1) {
      const radius = 0.18 + Math.random() * 0.24;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const wobble = 0.82 + Math.random() * 0.42;

      const x = Math.sin(phi) * Math.cos(theta) * radius * wobble;
      const y = Math.cos(phi) * radius * 0.72;
      const z = Math.sin(phi) * Math.sin(theta) * radius * wobble;

      pos[i * 3 + 0] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      scale[i] = 0.45 + Math.random() * 1.15;
      phase[i] = Math.random();

      sumX += x;
      sumY += y;
      sumZ += z;
    }

    const centerX = sumX / count;
    const centerY = sumY / count;
    const centerZ = sumZ / count;

    for (let i = 0; i < count; i += 1) {
      pos[i * 3 + 0] -= centerX;
      pos[i * 3 + 1] -= centerY;
      pos[i * 3 + 2] -= centerZ;
    }

    return [pos, scale, phase];
  }, []);

  useFrame((state, delta) => {
    const next = THREE.MathUtils.clamp(
      progressRef.current + (active ? 1 : -1) * (delta / 0.85),
      0,
      1
    );
    progressRef.current = next;
    const eased = (next * next * (3 - 2 * next)) * portalBlend;
    opacityRef.current = eased;

    if (eased <= 0.001 && !active) {
      if (materialRef.current) {
        materialRef.current.uOpacity = 0;
      }
      return;
    }

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.2;
      groupRef.current.rotation.x =
        Math.sin(state.clock.elapsedTime * 0.6) * 0.12;
      const scale = (0.78 + eased * 0.22) * (1 + Math.sin(state.clock.elapsedTime * 1.45) * 0.05);
      groupRef.current.scale.set(scale, scale * 0.82, scale);
    }

    if (materialRef.current) {
      materialRef.current.uTime = state.clock.elapsedTime;
      materialRef.current.uOpacity = eased;
      materialRef.current.uSize = 58 * pointSizeMultiplier;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <Float speed={0.85} rotationIntensity={0.08} floatIntensity={0.14}>
        <points renderOrder={999} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={positions.length / 3}
              array={positions}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-aScale"
              count={scales.length}
              array={scales}
              itemSize={1}
            />
            <bufferAttribute
              attach="attributes-aPhase"
              count={phases.length}
              array={phases}
              itemSize={1}
            />
          </bufferGeometry>
          <discoverBlobParticleMaterial
            ref={materialRef}
            transparent
            depthTest={false}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </Float>
    </group>
  );
}
