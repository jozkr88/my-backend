import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils";
import webGLFluidEnhanced from "webgl-fluid-enhanced";

import WelcomeDesktop from "./asx1.png";
import WelcomeMobile from "./asx1-mobile.png";
import { assetUrl } from "./utils/paths";

// (keeping your SVG + other code unchanged)

const ThreeJSComponent = ({ onProgress, onLoaded, onReady }) => {
  const mountRef = useRef(null);
  const renderer = useRef(null);
  const scene = useRef(null);
  const camera = useRef(null);
  const controls = useRef(null);
  const clock = useRef(new THREE.Clock());
  const pu = useRef({ morphRatio: { value: 1 } });
  const fadeOpacity = useRef(1.0);
  const fadeDuration = 2;
  const morphDuration = 16;
  const pauseDuration = 2;
  const fadeStartTime = morphDuration - fadeDuration;
  const scaleStartDelay = 0;
  const pauseTimeRef = useRef(0);

  const [showWelcomeText, setShowWelcomeText] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const canvasRef = useRef(null);



  useEffect(() => {
    if (isLoaded) {
      startWelcomeTimer();
    }
  }, [isLoaded]);

  const initThree = () => {
    scene.current = new THREE.Scene();

    camera.current = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      100
    );
    camera.current.position.set(0, 0, 20);

    renderer.current = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.current.setSize(window.innerWidth, window.innerHeight);
    renderer.current.setPixelRatio(window.devicePixelRatio);
    renderer.current.setClearColor(0x000000, 0);

    controls.current = new OrbitControls(camera.current, renderer.current.domElement);
    controls.current.enableDamping = true;

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.setScalar(1);
    scene.current.add(light, new THREE.AmbientLight(0xffffff, 0.5));

    window.addEventListener("resize", handleResize);
  };

  const cleanUp = () => {
    window.removeEventListener("resize", handleResize);
    renderer.current.dispose();
  };

  const handleResize = () => {
    camera.current.aspect = window.innerWidth / window.innerHeight;
    camera.current.updateProjectionMatrix();
    renderer.current.setSize(window.innerWidth, window.innerHeight);
  };

  const loadModels = async () => {
    const amount = 10000;
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Array(amount * 3).fill(0), 3)
    );

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(process.env.PUBLIC_URL + "/draco/");

    // 🔥 Hook into progress + load events
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const percent = Math.round((itemsLoaded / itemsTotal) * 100);
      if (onProgress) onProgress(percent);
    };
    loadingManager.onLoad = () => {
      setIsLoaded(true);
      if (onLoaded) onLoaded();
    };

    const loader = new GLTFLoader(loadingManager);
    loader.setDRACOLoader(dracoLoader);

    try {
      const gltf1 = await loader.loadAsync(assetUrl("ux.glb"));
      gltf1.scene.updateMatrixWorld(true);
      const model1 = new THREE.Mesh(mergeModel(gltf1.scene));
      g.setAttribute("positionStart", pointification(model1, amount));

      const gltf2 = await loader.loadAsync(assetUrl("heart.glb"));
      gltf2.scene.updateMatrixWorld(true);
      const model2 = new THREE.Mesh(mergeModel(gltf2.scene, 5));
      g.setAttribute("positionEnd", pointification(model2, amount));

      g.setAttribute(
        "rotDir",
        new THREE.Float32BufferAttribute(
          new Array(amount).fill().map(() => (Math.random() < 0.5 ? -1 : 1)),
          1
        )
      );

      const pointsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.05,
        transparent: true,
        opacity: fadeOpacity.current,
        alphaTest: 0.5,
        onBeforeCompile: (shader) => {
          shader.uniforms.morphRatio = pu.current.morphRatio;
          shader.vertexShader = `
            uniform float morphRatio;
            attribute vec3 positionStart;
            attribute vec3 positionEnd;
            attribute float rotDir;
      
            mat2 rot2d(float a){ return mat2(cos(a), sin(a), -sin(a), cos(a));}
            ${shader.vertexShader}
          `.replace(
            `#include <begin_vertex>`,
            `#include <begin_vertex>
              vec3 pStart = positionStart;
              vec3 pEnd = positionEnd;
              
              float distRatio = sin(morphRatio * PI);
              float fuzziness = 4.9;
      
              vec3 pos = mix(pStart, pEnd, morphRatio);
              pos.xz *= rot2d(PI2 * morphRatio);
              transformed = pos + normalize(pos) * distRatio * fuzziness;
            `
          );
        },
      });

      scene.current.add(new THREE.Points(g, pointsMaterial));

      renderer.current.setAnimationLoop(render);
    } catch (error) {
      console.error("Error loading models:", error);
    }
  };

  const render = () => {
    const dt = clock.current.getDelta();
    const t = clock.current.elapsedTime;

    controls.current.update();

    const morphRatio = Math.sin((t * (2 * Math.PI)) / morphDuration) * 0.5 + 0.5;

    if (pauseTimeRef.current > 0) {
      if (t - pauseTimeRef.current >= pauseDuration) {
        pauseTimeRef.current = 0;
        clock.current.start();
      } else {
        return;
      }
    } else if (morphRatio >= 1) {
      pauseTimeRef.current = t;
      clock.current.stop();
    }

    pu.current.morphRatio.value = morphRatio;

    if (t >= fadeStartTime && t <= morphDuration) {
      const fadeProgress = (t - fadeStartTime) / fadeDuration;
      fadeOpacity.current = THREE.MathUtils.lerp(1, 0, easeInOutQuad(fadeProgress));

      let scale = 1;
      if (fadeProgress >= scaleStartDelay / fadeDuration) {
        const scaleProgress =
          (fadeProgress - scaleStartDelay / fadeDuration) /
          (1 - scaleStartDelay / fadeDuration);
        scale = THREE.MathUtils.lerp(1, 2, easeInOutQuad(scaleProgress));
      }

      if (fadeOpacity.current <= 0.01 && !showWelcomeText) {
        fadeOpacity.current = 0;
        renderer.current.setAnimationLoop(null);
        setShowWelcomeText(true);

        // 🔥 Scene fully ready
        if (onReady) onReady();

        setTimeout(() => {
          setShowWelcomeText(false);
        }, 30000);
      }

      scene.current.children.forEach((child) => {
        if (child.isPoints) {
          child.material.opacity = fadeOpacity.current;
          child.scale.set(scale, scale, scale);
        }
      });
    }

    renderer.current.render(scene.current, camera.current);
  };

  const easeInOutQuad = (t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  // (mergeModel, pointification, startFluidSimulation, startWelcomeTimer unchanged)

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          pointerEvents: "none",
        }}
      ></div>
    </div>
  );
};

export default ThreeJSComponent;
