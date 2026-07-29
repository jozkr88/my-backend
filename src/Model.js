import React, { useRef, useState, useEffect } from 'react';
import { useGLTF, useAnimations, useThree } from 'drei';

const Model = ({ modelFile, animationFile, position, scale, onModelClick }) => {
  const group = useRef();
  const { scene, animations } = useGLTF(modelFile, true);
  const { actions, mixer } = useAnimations(animations, group);
  const [showNewModel, setShowNewModel] = useState(false);
  const { nodes } = useGLTF(animationFile);
  const { camera } = useThree();
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    actions.Animation.play();
  }, [mixer]);

  useEffect(() => {
    if (group.current && position) {
      group.current.position.set(...position);
      group.current.scale.set(0.15, 0.15, 0.15);
    }
  }, [position, scale]);

  const handleModelClick = () => {
    actions.Animation.paused = !actions.Animation.paused;
    setShowNewModel((prev) => !prev);

    if (onModelClick) {
      onModelClick();
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
        <group position={[0, -0.9, -2]} scale={[0.15, 0.15, 0.15]}>
          <primitive object={nodes.Scene} raycast={false} />
        </group>
      )}
    </>
  );
};

export { Model };
