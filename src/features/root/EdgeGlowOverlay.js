import * as THREE from "three";

import { useEffect, useRef } from "react";
import { extend, useFrame, useThree } from "@react-three/fiber";
import { OrthographicCamera, shaderMaterial } from "@react-three/drei";

const EdgeGlowMaterial = shaderMaterial(
  {
    uTime: 0,
    uOpacity: 0,
    uResolution: new THREE.Vector2(1, 1),
  },
  `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  `
    uniform float uTime;
    uniform float uOpacity;
    uniform vec2 uResolution;

    varying vec2 vUv;

    float roundedBoxSdf(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - b + r;
      return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    }

    vec2 perimeterPoint(float t) {
      float p = fract(t) * 4.0;

      if (p < 1.0) {
        return vec2(p, 1.03);
      }
      if (p < 2.0) {
        return vec2(1.03, 1.0 - (p - 1.0));
      }
      if (p < 3.0) {
        return vec2(1.0 - (p - 2.0), -0.03);
      }

      return vec2(-0.03, p - 3.0);
    }

    void main() {
      vec2 uv = vUv;
      float cornerRadius = 0.06;
      float roundedSdf = roundedBoxSdf(
        uv - 0.5,
        vec2(0.5 - cornerRadius),
        cornerRadius
      );
      float edgeDistance = max(-roundedSdf, 0.0);
      float cutout = 1.0 - smoothstep(0.0, 0.2, edgeDistance);
      float innerFeather = 1.0 - smoothstep(0.0, 0.24, edgeDistance);

      vec3 blue = vec3(0.08, 0.12, 1.0);
      vec3 red = vec3(1.0, 0.05, 0.05);
      vec3 yellow = vec3(1.0, 0.94, 0.0);
      vec3 white = vec3(0.96, 0.97, 1.0);

      float topTravel = 0.5 + 0.32 * sin(uTime * 0.45);
      float leftTravel = 0.48 + 0.3 * cos(uTime * 0.42);
      float bottomTravel = 0.52 + 0.28 * sin(uTime * 0.38 + 1.3);
      float rightTravel = 0.5 + 0.26 * cos(uTime * 0.4 + 0.8);

      float travel = uTime * 0.07;
      vec2 sweepA = perimeterPoint(travel);
      vec2 sweepB = perimeterPoint(travel - 0.1);
      vec2 sweepC = perimeterPoint(travel - 0.2);
      vec2 sweepD = perimeterPoint(travel - 0.3);
      vec2 sweepE = perimeterPoint(travel - 0.4);
      vec2 sweepF = perimeterPoint(travel - 0.5);

      float leftW = exp(-pow(distance(uv, vec2(-0.06, leftTravel)) / 0.18, 2.0));
      float topW = exp(-pow(distance(uv, vec2(topTravel, 1.06)) / 0.18, 2.0));
      float rightW = exp(-pow(distance(uv, vec2(1.06, rightTravel)) / 0.2, 2.0));
      float bottomW = exp(-pow(distance(uv, vec2(bottomTravel, -0.06)) / 0.2, 2.0));
      float sweepAField = exp(-pow(distance(uv, sweepA) / 0.18, 2.0));
      float sweepBField = exp(-pow(distance(uv, sweepB) / 0.18, 2.0));
      float sweepCField = exp(-pow(distance(uv, sweepC) / 0.19, 2.0));
      float sweepDField = exp(-pow(distance(uv, sweepD) / 0.2, 2.0));
      float sweepEField = exp(-pow(distance(uv, sweepE) / 0.21, 2.0));
      float sweepFField = exp(-pow(distance(uv, sweepF) / 0.22, 2.0));
      float sweepGlow =
        sweepAField * 1.0 +
        sweepBField * 0.98 +
        sweepCField * 0.94 +
        sweepDField * 0.9 +
        sweepEField * 0.86 +
        sweepFField * 0.82;

      float leftField = exp(-uv.x / 0.065);
      float topField = exp(-(1.0 - uv.y) / 0.055);
      float rightField = exp(-(1.0 - uv.x) / 0.06);
      float bottomField = exp(-uv.y / 0.065);

      vec3 color = vec3(0.0);
      vec3 softWhite = vec3(1.0, 0.98, 0.94);
      float edgeSum = leftField + topField + rightField + bottomField;
      float cornerTL = exp(-distance(uv, vec2(0.0, 1.0)) / 0.16);
      float cornerTR = exp(-distance(uv, vec2(1.0, 1.0)) / 0.16);
      float cornerBL = exp(-distance(uv, vec2(0.0, 0.0)) / 0.16);
      float cornerBR = exp(-distance(uv, vec2(1.0, 0.0)) / 0.16);
      vec3 staticEdgeColor = vec3(0.0);
      staticEdgeColor += blue * leftField * 0.45;
      staticEdgeColor += red * topField * 0.58;
      staticEdgeColor += mix(yellow, white, 0.28) * rightField * 0.42;
      staticEdgeColor += yellow * bottomField * 0.48;

      color += staticEdgeColor * 0.42;
      color += softWhite * edgeSum * 0.075;
      color += mix(softWhite, blue, 0.7) * leftW * 0.09;
      color += mix(softWhite, red, 0.75) * topW * 0.08;
      color += mix(softWhite, yellow, 0.65) * rightW * 0.08;
      color += mix(softWhite, yellow, 0.72) * bottomW * 0.09;
      color += mix(red, blue, 0.48) * cornerTL * 0.18;
      color += mix(red, yellow, 0.4) * cornerTR * 0.18;
      color += mix(blue, yellow, 0.42) * cornerBL * 0.16;
      color += mix(yellow, white, 0.35) * cornerBR * 0.16;

      color += red * sweepAField * 1.08;
      color += mix(red, blue, 0.42) * sweepBField * 1.02;
      color += blue * sweepCField * 0.98;
      color += mix(blue, yellow, 0.4) * sweepDField * 0.96;
      color += yellow * sweepEField * 0.94;
      color += mix(yellow, white, 0.36) * sweepFField * 0.92;
      color += white * sweepAField * 0.18;
      color += white * sweepCField * 0.12;
      color += white * sweepFField * 0.12;

      float edgeBand = max(max(leftField, rightField), max(topField, bottomField));
      float tightEdge = pow(edgeBand, 1.6);
      float softBloom = (leftField + rightField + topField + bottomField) * 0.045;
      float cornerDistance = min(
        min(distance(uv, vec2(0.0, 0.0)), distance(uv, vec2(1.0, 0.0))),
        min(distance(uv, vec2(0.0, 1.0)), distance(uv, vec2(1.0, 1.0)))
      );
      float cornerGlow = exp(-cornerDistance / 0.14);

      color += softWhite * cornerGlow * 0.12;

      float alpha = (tightEdge * 0.6 + softBloom + sweepGlow * 0.06 + cornerGlow * 0.08 + (cornerTL + cornerTR + cornerBL + cornerBR) * 0.03)
        * cutout
        * uOpacity;

      color *= innerFeather;
      color *= 0.52
        + (leftW + topW + rightW + bottomW) * 0.78
        + sweepGlow * 0.12;

      gl_FragColor = vec4(color, alpha);
    }
  `
);

extend({ EdgeGlowMaterial });

function EdgeGlowOverlay({ active }) {
  const { size } = useThree();
  const materialRef = useRef();

  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uResolution.set(size.width, size.height);
  }, [size.height, size.width]);

  useFrame((state, delta) => {
    const material = materialRef.current;
    if (!material) return;

    material.uTime = state.clock.elapsedTime;
    material.uOpacity = THREE.MathUtils.damp(
      material.uOpacity,
      active ? 1.18 : 0,
      3.8,
      delta
    );
  });

  return (
    <>
      <OrthographicCamera
        makeDefault
        position={[0, 0, 5]}
        zoom={1}
        near={0.1}
        far={10}
      />
      <mesh frustumCulled={false} renderOrder={2000}>
        <planeGeometry args={[2, 2]} />
        <edgeGlowMaterial
          ref={materialRef}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
}

export { EdgeGlowOverlay };
