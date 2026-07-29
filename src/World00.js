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


const World00 = () => {
  const isMobile = useMedia('(max-width: 768px)');

  const textureFiles = isMobile
    ? ['pxj-m.webp', 'nxj-m.webp', 'pyj-m.webp', 'nyj-m.webp', 'pzj-m.webp', 'nzj-m.webp']
    : ['pxj.webp', 'nxj.webp', 'pyj.webp', 'nyj.webp', 'pzj.webp', 'nzj.webp'];

  return <Environment background={true} files={textureFiles} />;
};

export default World00;