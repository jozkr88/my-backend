import * as THREE from 'three';



import { Physics, PlaneProps, useBox, usePlane } from '@react-three/cannon';

import { memo, useEffect, useRef, useState, Suspense } from 'react';
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, MapControls, PerspectiveCamera, useAspect, useVideoTexture, useTexture, useProgress, PresentationControls } from "@react-three/drei";
import { useCursor, MeshPortalMaterial, CameraControls, Gltf, SpotLight, Shadow, useGLTF, shaderMaterial, GradientTexture, Text, useAnimations, Html, Environment, group, Sky, PointLight, Float } from '@react-three/drei';
import { useRoute, useLocation } from 'wouter';
import { easing, geometry } from 'maath';
import { suspend } from 'suspend-react';
import { useMedia } from 'react-use';

import { MeshStandardMaterial, CubeTextureLoader, MeshBasicMaterial, RGBELoader } from 'three';


const Zeit = ({ position, scale, onModelClick }) => {
  const group = useRef();


  const isMobile = window.innerWidth < 768 || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);





  const glbFilePath = isMobile ? "diamond-m.glb" : "diamond.glb";

  const { scene, animations } = useGLTF("zeit-desktop.glb", true);
  const { actions, mixer } = useAnimations(animations, group);

  const [showNewModel, setShowNewModel] = useState(false);
  const { nodes } = useGLTF(glbFilePath);
  const [hovered, setHovered] = useState(false);
    useCursor(hovered, 'pointer'); // Assuming useCursor is working as expected
  const { camera } = useThree();


  useEffect(() => {
    actions.Animation.play();
  }, [mixer]);



  useEffect(() => {
    if (group.current && position) {
      group.current.position.set(...position);
      group.current.scale.set(1, 1, 1);
    }
  }, [position, scale]);

  
  const handleModelClick = () => {
    actions.Animation.paused = !actions.Animation.paused;
    setShowNewModel((prev) => !prev);

    if (onModelClick) {
      onModelClick();
    }
  };

  let usdzFileLaunched = false; // Flag to track if usdz file has been launched

const handleA1xModelClick = () => {
    // Check if the usdz file has already been launched
    if (usdzFileLaunched) {
        return; // Exit the function if already launched
    }

    if (showNewModel && nodes) {
        const cd1 = (/iPad|iPhone|iPod/.test(navigator.userAgent) && !self.MSStream) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const cd2 = /Android/.test(navigator.userAgent);
        const cd3 = /firefox/i.test(navigator.userAgent);
        const cd4 = /OculusBrowser/.test(navigator.userAgent);
        const cd5 = cd2 && !cd3 && !cd4;

        if (cd1) {
            // Check if running in iOS Safari proper or within a WKWebView component instance
            const cd7 = Boolean(window.webkit && window.webkit.messageHandlers);
            const cd6 = (() => {
                if (!cd7) {
                    // Check for AR Quick Look feature support in iOS Safari
                    const tempAnchor = document.createElement('a');
                    return Boolean(tempAnchor.relList && tempAnchor.relList.supports && tempAnchor.relList.supports('ar'));
                } else {
                    // Check for known AR Quick Look compatible iOS browsers
                    return Boolean(/CriOS\/|EdgiOS\/|FxiOS\/|GSA\/|DuckDuckGo\//.test(navigator.userAgent));
                }
            })();
            
            if (cd6) {
                // Create and configure the link for AR Quick Look
                const link = document.createElement('a');
                link.textContent = 'glb file';
                link.href = 'https://iamjoz.com/diamond.usdz';
                link.rel = 'ar';

                // Create and append image element
                const img = document.createElement('img');
                img.src = 'usdz.png';
                img.alt = '';
                link.appendChild(img);

                // Append link to the body and trigger click
                document.body.appendChild(link);
                link.click();

                // Set the flag to true to prevent multiple launches
                usdzFileLaunched = true;

                   // Reset the flag after 2 seconds
                   setTimeout(() => {
                    usdzFileLaunched = false;
                }, 1000);


            } else {
                // Handle the case where AR Quick Look is not supported
                console.log('AR Quick Look is not supported on this device/browser.');
            }
        } else if (cd5) {
            // Create and configure the link for Android AR
            const link = document.createElement('a');
            link.textContent = 'glb file';
            link.href = 'intent://arvr.google.com/scene-viewer/1.0?file=https://iamjoz.com/diamond-adr.glb#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=https://developers.google.com/ar;end;';
            // Append link to the body
            document.body.appendChild(link);

            // Trigger click
            link.click();

            // Set the flag to true to prevent multiple launches
            usdzFileLaunched = true;

               // Reset the flag after 2 seconds
               setTimeout(() => {
                usdzFileLaunched = false;
            }, 2000);


        } else {
            // Handle the case where neither AR Quick Look nor Scene Viewer is supported
            console.log('AR experience is not supported on this device/browser.');
        }
    }
};

  return (
    <>
      <primitive
        ref={group}
        object={scene}
        dispose={null}
        onClick={handleModelClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      />
      {showNewModel && nodes && (
     <group position={[0, -0.2, 3]} scale={[1.3, 1.3, 1.3]}>
          <primitive
            object={nodes.Scene}
            onClick={handleA1xModelClick}
            onPointerOver={() => setHovered(false)}
            onPointerOut={() => setHovered(false)}
          />
        </group>
      )}
    </>
  );
};

export default Zeit;