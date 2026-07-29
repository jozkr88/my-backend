import * as THREE from "three";

import { memo, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshPortalMaterial, Text, useCursor } from "@react-three/drei";
import { suspend } from "suspend-react";
import { useLocation, useRoute } from "wouter";
import { easing } from "maath";

import { APP_ACTIONS } from "../../state/actionTypes";

export const Frame = memo(function Frame({
  id,
  name,
  description,
  blend,
  bg,
  width = 1.5,
  height = 1.5,
  regularFont,
  mediumFont,
  children,
  onBlendChange,
  ...props
}) {
  const portal = useRef();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/neo/:id");
  const [hovered, setHovered] = useState(false);

  const isActive = params?.id === id;

  useCursor(hovered);

  useEffect(() => {
    if (!portal.current && typeof onBlendChange === "function") {
      onBlendChange(0);
    }
  }, [onBlendChange]);

  useFrame((state, dt) => {
    if (!portal.current) {
      if (typeof onBlendChange === "function") onBlendChange(0);
      return;
    }
    easing.damp(portal.current, "blend", isActive ? 1 : 0, 0.2, dt);
    if (typeof onBlendChange === "function") {
      onBlendChange(portal.current.blend);
    }
  });

  let fontSize = 0.2;
  let anchorX = "center";
  let textPosition = [0, 0, 0.01];
  let textColor = "#ffffff";
  let nextWidth = width;
  let nextHeight = height;

  if (id === "meet-joz") {
    fontSize = 0;
    nextWidth = 0.37;
    nextHeight = 0.37;
    textPosition = [0, 0, 0];
    textColor = "#ffffff";
  } else if (["maxx", "toolkit", "skills"].includes(id)) {
    fontSize = 0;
    anchorX = "center";
    textPosition = [0, 0, -0.001];
    nextWidth = 0.4;
    nextHeight = 0.4;
  }

  const descriptionWidth = 300;

  return (
    <group {...props}>
      {name.split("\n").map((line, index) => (
        <Text
          key={index}
          font={suspend(mediumFont).default}
          fontSize={fontSize}
          anchorX={anchorX}
          lineHeight={1}
          position={[
            textPosition[0],
            textPosition[1] - index * fontSize,
            textPosition[2],
          ]}
          color={textColor}
          material-toneMapped={false}
        >
          {String(line).trim()}
        </Text>
      ))}

      {description && (
        <Text
          font={suspend(regularFont).default}
          fontSize={0.16}
          lineHeight={1}
          color="black"
          anchorX={anchorX}
          position={[0.0, -1.9, 0.01]}
          material-toneMapped={false}
          maxWidth={descriptionWidth}
        >
          {String(description).trim()}
        </Text>
      )}

      <mesh
        name={id}
        visible={false}
        onClick={(e) => {
          e.stopPropagation();
          const targetPath = `/neo/${e.object.name}`;
          const handled = window.__dispatchAppAction?.(APP_ACTIONS.NAVIGATE, {
            targetPath,
          });
          if (!handled) {
            setLocation(targetPath);
          }
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <roundedPlaneGeometry args={[nextWidth, nextHeight, 0.2]} />
        <MeshPortalMaterial
          ref={portal}
          events={isActive}
          side={THREE.DoubleSide}
        >
          <color attach="background" args={[bg]} />
          {Array.isArray(children)
            ? children.filter((child) => typeof child !== "string")
            : typeof children === "string"
              ? null
              : children}
        </MeshPortalMaterial>
      </mesh>
    </group>
  );
});
