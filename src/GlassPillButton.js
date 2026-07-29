import { Capsule, Text } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import { a, useSprings, useSpring } from "@react-spring/three";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const panelLinks = [
  { title: "Luqid", index: 0 },
  { title: "Dynamic", index: 1 },
  { title: "Intelligent", index: 2 },
  { title: "The Process", index: 3 },
  { title: "About Joz", index: 4 },
  { title: "Connect", index: 5 },
];

export default function GlassPillButton({ scrollToFrame, onToggleMenu }) {
  const groupRef = useRef();
  const { camera } = useThree();
  const [expanded, setExpanded] = useState(false);

  // Springs for main + submenu
  const { scale } = useSpring({
    scale: expanded ? [0, 0, 0] : [1, 1, 1],
    config: { mass: 1, tension: 160, friction: 18 },
  });

  const { menuScale } = useSpring({
    menuScale: expanded ? [1, 1, 1] : [0, 0, 0],
    config: { mass: 1, tension: 160, friction: 18 },
  });

  const springs = useSprings(
    panelLinks.length,
    panelLinks.map((_, i) => ({
      scale: expanded ? [1.1, 1.1, 0.3] : [0, 0, 0],
      opacity: expanded ? 1 : 0,
      config: { mass: 4, tension: 160, friction: 18 },
      delay: expanded ? i * 100 : (panelLinks.length - i - 1) * 100,
    }))
  );

  // Glassy material
  const glassMaterial = useMemo(
    () =>
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
      }),
    []
  );

  // Keep HUD pinned to middle-right corner responsively
  useFrame(() => {
    if (!groupRef.current) return;

    // NDC coords for middle-right (x=0.9, y=0)
    const ndc = new THREE.Vector3(0.9, 0, -1);
    ndc.unproject(camera);

    const dir = ndc.clone().sub(camera.position).normalize();
    const distance = 2; // how far in front of camera
    const worldPos = camera.position.clone().add(dir.multiplyScalar(distance));

    groupRef.current.position.copy(worldPos);

    // always face the camera
    groupRef.current.quaternion.copy(camera.quaternion);
  });

  const handleLinkClick = (index) => {
    scrollToFrame?.(index);
    setExpanded(false);
    onToggleMenu?.(false);
  };

  return (
    <group ref={groupRef} scale={[4.35, 4.35, 4.35]}>
      {/* Main menu button */}
      <a.group scale={scale}>
        <Capsule
          args={[0.015, 0.04, 32, 32]}
          scale={[2.6, 2.6, 0.3]}
          material={glassMaterial}
          rotation={[0, 0, -Math.PI / 2]}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
            onToggleMenu?.(true);
          }}
        >
          <Text
            anchorX="center"
            anchorY="middle"
            font="/webfonts/Inter-Medium.ttf"
            position={[0, 0, 0.02]}
            fontSize={0.0095}
            rotation={[0, 0, Math.PI / 2]}
            color="white"
          >
            Menu
          </Text>
        </Capsule>
      </a.group>

      {/* Submenu links */}
      <a.group position={[0, -0.15, 0]} scale={menuScale}>
        {panelLinks.map((link, i) => {
          const spacing = 0.05;
          const y = -i * spacing;

          return (
            <a.group
              key={link.index}
              position={[0, y, 0.03]}
              scale={springs[i].scale}
              opacity={springs[i].opacity}
            >
              <Capsule
                args={[0.015, 0.04, 32, 32]}
                scale={[1.1, 1.1, 0.3]}
                material={glassMaterial}
                rotation={[0, 0, -Math.PI / 2]}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLinkClick(link.index);
                }}
              >
                <Text
                  anchorX="center"
                  anchorY="middle"
                  font="/webfonts/Inter-Medium.ttf"
                  position={[0, 0, 0.1]}
                  fontSize={0.0065}
                  rotation={[0, 0, Math.PI / 2]}
                  color="white"
                >
                  {link.title}
                </Text>
              </Capsule>
            </a.group>
          );
        })}
      </a.group>
    </group>
  );
}
