import * as THREE from "three"
import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"

const VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uSize;
  uniform float uSpeed;
  varying float vAlpha;

  // tiny noise-ish motion using sin/cos; cheap & branchless
  vec3 wiggle(vec3 p, float s, float t) {
    float k = 0.8 + fract(aSeed) * 1.6;
    p.x += sin(p.y * k + t * s) * 0.12;
    p.y += cos(p.z * k + t * s * 1.1) * 0.12;
    p.z += sin(p.x * k + t * s * 0.9) * 0.12;
    return p;
  }

  void main() {
    vec3 p = position;
    p = wiggle(p, uSpeed, uTime);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    // perspective-correct size
    gl_PointSize = uSize * (300.0 / max(1.0, -mv.z));

    // fade smaller/softer in distance
    vAlpha = clamp(1.0 - (-mv.z) / 60.0, 0.1, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;

  void main() {
    // soft circular sprite
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float r = dot(uv, uv);
    float circle = smoothstep(1.0, 0.0, r);
    float a = circle * vAlpha * uOpacity;
    gl_FragColor = vec4(uColor, a);
  }
`;

export default function Particles({
  count = 15000,
  shape = "sphere",         // "sphere" | "box" | "disk"
  radius = 3,
  box = [4, 4, 4],          // used if shape="box"
  size = 6,                 // pixel size at ~1m
  color = "#9fdcff",
  opacity = 1,
  speed = 0.6,
  blending = "additive",    // "additive" | "normal"
  position = [0, 0, 0],
}) {
  const materialRef = useRef()

  // Generate initial positions + seeds once
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)

    const randInSphere = () => {
      // pick random direction & radius^(1/3) for uniform volume
      const u = Math.random(), v = Math.random()
      const theta = u * Math.PI * 2.0
      const phi = Math.acos(2.0 * v - 1.0)
      const r = Math.cbrt(Math.random()) * radius
      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = r * Math.sin(phi) * Math.sin(theta)
      const z = r * Math.cos(phi)
      return new THREE.Vector3(x, y, z)
    }

    const randInDisk = () => {
      const ang = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * radius
      return new THREE.Vector3(Math.cos(ang) * r, (Math.random() - 0.5) * 0.02, Math.sin(ang) * r)
    }

    const randInBox = () => {
      const [bx, by, bz] = box
      return new THREE.Vector3(
        (Math.random() - 0.5) * bx,
        (Math.random() - 0.5) * by,
        (Math.random() - 0.5) * bz
      )
    }

    for (let i = 0; i < count; i++) {
      let p
      if (shape === "box") p = randInBox()
      else if (shape === "disk") p = randInDisk()
      else p = randInSphere()

      positions[i * 3 + 0] = p.x
      positions[i * 3 + 1] = p.y
      positions[i * 3 + 2] = p.z
      seeds[i] = Math.random() * 1000
    }

    g.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1))
    return g
  }, [count, shape, radius, box])

  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: blending === "additive" ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: size },
        uSpeed: { value: speed },
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity },
      },
    })
    return m
  }, [size, speed, color, opacity, blending])

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return (
    <points position={position} args={[geometry, material]}>
      {/* Keep a ref to mutate uniforms every frame */}
      <primitive object={material} ref={materialRef} attach="material" />
    </points>
  )
}
