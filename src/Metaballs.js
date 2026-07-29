import React, { useRef, useMemo } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { MarchingCubes as DreiMarchingCubes } from "@react-three/drei"
import { useRoute } from "wouter"

let time = 0

const createGlassMaterial = () =>
  new THREE.MeshPhysicalMaterial({
    color: "white",
    metalness: 0,
    roughness: 0,
    transmission: true,
    ior: 1.2,
    thickness: 0.5,
    reflectivity: 0.9,
    clearcoat: 0.1,
    clearcoatRoughness: 0.3,
  })

export default function Metaballs({
  position = [0, 0, 0],
  scale = .9,
  speed = 1.0,
  numBlobs = 7,
  resolution = 70,
  isolation = 180,
  floor = false,
  wallx = false,
  wallz = false,
  pauseInPortal = true,
  activePortalId = null,
  visible = true,
  fadeSpeed = 3.2,
  blobRevealDelay = 0,
  blobRevealStagger = 0,
  blobRevealWindow = 0.24,
  blobRevealMin = 0,
  blobRevealOrigin = null,
  blobRevealWorldOrigin = null,
  blobRevealSpread = 1,
  clusterRevealWorldOrigin = null,
  clusterRevealSpread = 1.8,
  orbitRadius = 0.22,
  orbitRadiusJitter = 0.025,
  orbitRadiusWave = 0.015,
  verticalCenter = 0.5,
  verticalAmplitude = 0.16,
  verticalWave = 0.04,
  blobSubtract = 12,
  blobStrengthScale = 1,
}) {
  const ref = useRef()
  const opacityRef = useRef(visible ? 1 : 0)

  // ✅ detect if user is inside ANY portal (/neo/:id)
  const [, params] = useRoute("/neo/:id")
  const currentPortal = params?.id || null
  const insidePortal = Boolean(currentPortal)
  const isActivePortal = activePortalId ? currentPortal === activePortalId : true

  const glassMaterial = useMemo(
    () => createGlassMaterial(),
    []
  )

  useFrame((_, delta) => {
    const m = ref.current
    if (!m) return

    if (m.material !== glassMaterial) m.material = glassMaterial
    if (m.isolation !== isolation) m.isolation = isolation
    if (m.resolution !== Math.floor(resolution)) m.init?.(Math.floor(resolution))

    if ((pauseInPortal && insidePortal) || !isActivePortal) {
      opacityRef.current = 0
      glassMaterial.transparent = true
      glassMaterial.opacity = 0
      m.visible = false
      return
    }

    opacityRef.current = THREE.MathUtils.damp(
      opacityRef.current,
      visible ? 1 : 0,
      fadeSpeed,
      delta
    )
    const clusterRevealDuration = Math.max(
      0.0001,
      blobRevealWindow + blobRevealStagger * Math.max(0, numBlobs - 1)
    )
    const clusterRevealProgress = THREE.MathUtils.clamp(
      (opacityRef.current - blobRevealDelay) / clusterRevealDuration,
      0,
      1
    )
    const clusterRevealEased = THREE.MathUtils.smootherstep(clusterRevealProgress, 0, 1)
    const clusterSpreadFactor = Math.pow(
      clusterRevealEased,
      Math.max(0.2, clusterRevealSpread)
    )

    if (clusterRevealWorldOrigin) {
      m.position.set(
        THREE.MathUtils.lerp(clusterRevealWorldOrigin[0], position[0], clusterSpreadFactor),
        THREE.MathUtils.lerp(clusterRevealWorldOrigin[1], position[1], clusterSpreadFactor),
        THREE.MathUtils.lerp(clusterRevealWorldOrigin[2], position[2], clusterSpreadFactor)
      )
    } else {
      m.position.set(position[0], position[1], position[2])
    }
    glassMaterial.transparent = opacityRef.current < 0.999
    glassMaterial.opacity = opacityRef.current
    m.visible = opacityRef.current > 0.01

    time += delta * speed * 0.5
    m.reset()

    const subtract = blobSubtract
    const strength =
      (1.2 / ((Math.sqrt(numBlobs) - 1) / 4 + 1)) * blobStrengthScale
    const revealWindow = Math.max(0.0001, blobRevealWindow)
    const uniformScale = Array.isArray(scale) ? scale[0] ?? 1 : scale
    const revealOrigin = blobRevealWorldOrigin
      ? [
          0.5 + (blobRevealWorldOrigin[0] - position[0]) / uniformScale,
          0.5 + (blobRevealWorldOrigin[1] - position[1]) / uniformScale,
          0.5 + (blobRevealWorldOrigin[2] - position[2]) / uniformScale,
        ]
      : blobRevealOrigin ?? [0.5, 0.5, 0.5]

    for (let i = 0; i < numBlobs; i++) {
      const phase = (i / Math.max(1, numBlobs)) * Math.PI * 2
      const drift = time * (0.32 + i * 0.028)
      const radius =
        orbitRadius +
        Math.sin(drift * 0.24 + phase * 1.4) * orbitRadiusJitter +
        Math.cos(drift * 0.11 + phase * 0.7) * orbitRadiusWave
      const angle = drift + phase
      const ballx = 0.5 + Math.cos(angle) * radius
      const bally =
        verticalCenter +
        Math.sin(drift * 0.46 + phase * 1.1) * verticalAmplitude +
        Math.cos(drift * 0.18 + phase * 0.5) * verticalWave
      const ballz = 0.5 + Math.sin(angle) * radius
      const staggerStart = blobRevealDelay + i * blobRevealStagger
      const staggeredProgress =
        blobRevealStagger > 0
          ? THREE.MathUtils.clamp((opacityRef.current - staggerStart) / revealWindow, 0, 1)
          : THREE.MathUtils.clamp((opacityRef.current - blobRevealDelay) / revealWindow, 0, 1)
      const easedReveal = THREE.MathUtils.smootherstep(staggeredProgress, 0, 1)
      const revealFactor =
        THREE.MathUtils.lerp(blobRevealMin, 1, easedReveal)
      if (revealFactor <= 0.001) continue
      const spreadFactor = Math.pow(easedReveal, Math.max(0.2, blobRevealSpread))
      const revealX = THREE.MathUtils.lerp(revealOrigin[0], ballx, spreadFactor)
      const revealY = THREE.MathUtils.lerp(revealOrigin[1], bally, spreadFactor)
      const revealZ = THREE.MathUtils.lerp(revealOrigin[2], ballz, spreadFactor)

      m.addBall(revealX, revealY, revealZ, strength * revealFactor, subtract)
    }

    if (floor) m.addPlaneY(2, 12)
    if (wallz) m.addPlaneZ(2, 12)
    if (wallx) m.addPlaneX(2, 12)

    m.update()
  })

  return (
    <DreiMarchingCubes
      ref={ref}
      position={position}
      scale={[scale, scale, scale]}
      resolution={Math.floor(resolution)}
      maxPolyCount={100000}
      raycast={() => null}
    >
      <meshPhysicalMaterial /> {/* placeholder, replaced in useFrame */}
    </DreiMarchingCubes>
  )
}

export function PillBurstMetaballs({
  position = [0, 0, -2],
  scale = 0.9,
  speed = 1,
  numBlobs = 7,
  resolution = 76,
  isolation = 180,
  pauseInPortal = false,
  activePortalId = "meet-joz",
  visible = true,
  fadeSpeed = 3.2,
  sourceWorldPoint = [0, -0.56, -2],
  revealProgress = null,
}) {
  const ref = useRef()
  const opacityRef = useRef(visible ? 1 : 0)
  const motionTimeRef = useRef(0)
  const prevRevealProgressRef = useRef(null)

  const [, params] = useRoute("/neo/:id")
  const currentPortal = params?.id || null
  const insidePortal = Boolean(currentPortal)
  const isActivePortal = activePortalId ? currentPortal === activePortalId : true

  const glassMaterial = useMemo(() => createGlassMaterial(), [])

  const uniformScale = Array.isArray(scale) ? scale[0] ?? 1 : scale
  const sourceLocal = useMemo(
    () => [
      0.5 + (sourceWorldPoint[0] - position[0]) / uniformScale,
      0.5 + (sourceWorldPoint[1] - position[1]) / uniformScale,
      0.5 + (sourceWorldPoint[2] - position[2]) / uniformScale,
    ],
    [position, sourceWorldPoint, uniformScale]
  )

  useFrame((_, delta) => {
    const m = ref.current
    if (!m) return

    if (m.material !== glassMaterial) m.material = glassMaterial
    if (m.isolation !== isolation) m.isolation = isolation
    if (m.resolution !== Math.floor(resolution)) m.init?.(Math.floor(resolution))

    if ((pauseInPortal && insidePortal) || !isActivePortal) {
      opacityRef.current = 0
      glassMaterial.transparent = true
      glassMaterial.opacity = 0
      m.visible = false
      return
    }

    if (typeof revealProgress === "number") {
      const rawProgress = THREE.MathUtils.clamp(revealProgress, 0, 1)
      const baseProgress = THREE.MathUtils.smootherstep(
        THREE.MathUtils.smootherstep(rawProgress, 0, 1),
        0,
        1
      )
      const isReversing =
        prevRevealProgressRef.current !== null &&
        rawProgress < prevRevealProgressRef.current - 1e-4
      const targetProgress = isReversing
        ? Math.pow(baseProgress, 0.72)
        : baseProgress
      opacityRef.current = THREE.MathUtils.damp(
        opacityRef.current,
        targetProgress,
        isReversing ? 4.2 : 8,
        delta
      )
      prevRevealProgressRef.current = rawProgress
    } else {
      opacityRef.current = THREE.MathUtils.damp(
        opacityRef.current,
        visible ? 1 : 0,
        fadeSpeed,
        delta
      )
      prevRevealProgressRef.current = null
    }
    glassMaterial.transparent = opacityRef.current < 0.999
    glassMaterial.opacity = opacityRef.current
      m.visible = opacityRef.current > 0.01
      m.position.set(position[0], position[1], position[2])

    motionTimeRef.current += delta * speed * 0.55
    const t = motionTimeRef.current

    m.reset()

    const subtract = 12
    const strength = 1.2 / ((Math.sqrt(numBlobs) - 1) / 4 + 1)
    const revealDelay = 0.24
    const revealStagger = 0.065
    const revealWindow = 0.66

    for (let i = 0; i < numBlobs; i++) {
      const phase = (i / Math.max(1, numBlobs)) * Math.PI * 2
      const drift = t * (0.32 + i * 0.028)
      const radius =
        0.22 +
        Math.sin(drift * 0.24 + phase * 1.4) * 0.025 +
        Math.cos(drift * 0.11 + phase * 0.7) * 0.015
      const angle = drift + phase
      const targetX = 0.5 + Math.cos(angle) * radius
      const targetY =
        0.5 +
        Math.sin(drift * 0.46 + phase * 1.1) * 0.16 +
        Math.cos(drift * 0.18 + phase * 0.5) * 0.04
      const targetZ = 0.5 + Math.sin(angle) * radius
      const revealProgress = THREE.MathUtils.clamp(
        (opacityRef.current - (revealDelay + i * revealStagger)) / revealWindow,
        0,
        1
      )
      const eased = THREE.MathUtils.smootherstep(revealProgress, 0, 1)
      if (eased <= 0.001) continue
      const spread = Math.pow(eased, 2.2)
      const scaleReveal = Math.pow(eased, 2.8)

      m.addBall(
        THREE.MathUtils.lerp(sourceLocal[0], targetX, spread),
        THREE.MathUtils.lerp(sourceLocal[1], targetY, spread),
        THREE.MathUtils.lerp(sourceLocal[2], targetZ, spread),
        strength * scaleReveal,
        subtract
      )
    }

    m.update()
  })

  return (
    <DreiMarchingCubes
      ref={ref}
      position={position}
      scale={[scale, scale, scale]}
      resolution={Math.floor(resolution)}
      maxPolyCount={100000}
      raycast={() => null}
    >
      <meshPhysicalMaterial />
    </DreiMarchingCubes>
  )
}
