import React, { useEffect, useRef } from "react"

// IMPORTANT: you need a recent three.js that includes the WebGPU build + TSL.
// e.g. three >= r165 (verify with your setup)
import * as THREE from "three/webgpu"
import {
  color, cos, float, mix, range, sin, time, uniform, uv, vec3, vec4, PI2
} from "three/tsl"

import { OrbitControls } from "three/addons/controls/OrbitControls.js"

export default function GalaxyWebGPU({
  // props you can tweak from your app
  count = 20000,
  size = 0.08,
  innerColor = "#ffa575",
  outerColor = "#311599",
  branches = 3,
  background = "#201919",
  cameraPos = [4, 2, 5],
  dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1,
  style = { width: "100%", height: "100%", display: "block" },
}) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Basic feature check
    if (!("gpu" in navigator)) {
      container.innerHTML =
        `<div style="color:#fff;padding:1rem;font:14px/1.4 system-ui;">
          WebGPU is not available in this browser. Try the latest Chrome/Edge with the "WebGPU" flag enabled.
        </div>`
      return
    }

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(background)

    // Camera
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    camera.position.set(...cameraPos)

    // Renderer
    const renderer = new THREE.WebGPURenderer({ antialias: true })
    renderer.setPixelRatio(dpr)
    container.appendChild(renderer.domElement)

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.minDistance = 0.1
    controls.maxDistance = 50

    // ---------- Galaxy material (TSL) ----------
    const spriteMat = new THREE.SpriteNodeMaterial({
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    // size control
    const uSize = uniform(size)
    spriteMat.scaleNode = range(0, 1).mul(uSize)

    // radius & angle
    const radiusRatio = range(0, 1)
    const radius = radiusRatio.pow(1.5).mul(5).toVar()

    const branchAngle = range(0, branches).floor().mul(PI2.div(branches))
    const angle = branchAngle.add(time.mul(radiusRatio.oneMinus()))

    const pos = vec3(
      cos(angle),
      0,
      sin(angle)
    ).mul(radius)

    // randomized offset for “noise”
    const randomOffset = range(vec3(-1), vec3(1)).pow(3).mul(radiusRatio).add(0.2)
    spriteMat.positionNode = pos.add(randomOffset)

    // color/alpha
    const uColorInside = uniform(color(innerColor))
    const uColorOutside = uniform(color(outerColor))
    const colorFinal = mix(
      uColorInside,
      uColorOutside,
      radiusRatio.oneMinus().pow(2).oneMinus()
    )
    const alpha = float(0.1).div(uv().sub(0.5).length()).sub(0.2)
    spriteMat.colorNode = vec4(colorFinal, alpha)

    // Mesh (instanced sprites via PlaneGeometry)
    const geometry = new THREE.PlaneGeometry(1, 1)
    const mesh = new THREE.InstancedMesh(geometry, spriteMat, count)
    scene.add(mesh)

    // Resize
    function onResize() {
      const { clientWidth, clientHeight } = container
      if (clientWidth === 0 || clientHeight === 0) return
      renderer.setSize(clientWidth, clientHeight, false)
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(container)
    onResize()

    // Animate
    renderer.setAnimationLoop(() => {
      controls.update()
      renderer.render(scene, camera)
    })

    // Apply prop updates on-the-fly (colors/size)
    // If you need to change `branches` dynamically, rebuild the material (not shown).
    const updateProps = () => {
      uSize.value = size
      uColorInside.value.set(innerColor)
      uColorOutside.value.set(outerColor)
      scene.background.set(background)
    }
    updateProps()

    // Cleanup
    return () => {
      renderer.setAnimationLoop(null)
      ro.disconnect()
      controls.dispose()
      geometry.dispose()
      spriteMat.dispose?.()
      scene.clear()
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [count, size, innerColor, outerColor, branches, background, cameraPos, dpr])

  return <div ref={containerRef} style={style} />
}
