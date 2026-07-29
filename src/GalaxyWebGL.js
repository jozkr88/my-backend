import * as THREE from "three"
import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"

// GLSL shaders (ported from the WebGL demo)
const VERT = /* glsl */ `
  attribute float aRadiusRatio;
  attribute float aBranch;
  attribute float aSeed;
  uniform float uTime;
  uniform float uBranches;
  uniform float uSpin;
  varying float vRadiusRatio;

  void main() {
    float radius = pow(aRadiusRatio, 1.5) * 5.0;
    float branchAngle = floor(aBranch) * (6.28318530718 / uBranches);
    float angle = branchAngle + uSpin * (1.0 - aRadiusRatio) * uTime;

    vec3 pos = vec3(cos(angle), 0.0, sin(angle)) * radius;

    float s1 = sin(aSeed * 12.9898 + 78.233) * 43758.5453;
    float s2 = sin((aSeed + 1.234) * 12.9898 + 78.233) * 43758.5453;
    float s3 = sin((aSeed + 5.678) * 12.9898 + 78.233) * 43758.5453;
    vec3 offset = vec3(fract(s1), fract(s2), fract(s3)) * 2.0 - 1.0;
    offset = offset * offset * offset;
    offset *= aRadiusRatio + 0.2;

    pos += offset;

    vRadiusRatio = aRadiusRatio;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = 100.0 / -mvPosition.z;
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColorInside;
  uniform vec3 uColorOutside;
  varying float vRadiusRatio;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float r = length(uv);
    float alpha = clamp(0.1 / max(r, 0.001) - 0.2, 0.0, 1.0);

    vec3 color = mix(uColorInside, uColorOutside, 1.0 - pow(1.0 - vRadiusRatio, 2.0));
    gl_FragColor = vec4(color, alpha);
  }
`

export default function Galaxy({
  count = 20000,
  branches = 3,
  spin = 1.0,
  innerColor = "#ffa575",
  outerColor = "#311599",
}) {
  const pointsRef = useRef()

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const aRadiusRatio = new Float32Array(count)
    const aBranch = new Float32Array(count)
    const aSeed = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      aRadiusRatio[i] = Math.random()
      aBranch[i] = Math.floor(Math.random() * branches)
      aSeed[i] = Math.random() * 1000.0
    }

    geo.setAttribute("aRadiusRatio", new THREE.BufferAttribute(aRadiusRatio, 1))
    geo.setAttribute("aBranch", new THREE.BufferAttribute(aBranch, 1))
    geo.setAttribute("aSeed", new THREE.BufferAttribute(aSeed, 1))

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uBranches: { value: branches },
        uSpin: { value: spin },
        uColorInside: { value: new THREE.Color(innerColor) },
        uColorOutside: { value: new THREE.Color(outerColor) },
      },
    })

    return { geometry: geo, material: mat }
  }, [count, branches, spin, innerColor, outerColor])

  useFrame(({ clock }) => {
    if (material.uniforms.uTime) {
      material.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return <points ref={pointsRef} args={[geometry, material]} />
}
