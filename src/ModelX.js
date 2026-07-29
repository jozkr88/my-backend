import React, { useRef, useEffect, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';

const Model1x = ({ position, scale, onModelClick }) => {
  const group = useRef();
  const { scene, animations } = useGLTF("m1x.glb", true);
  const { actions, mixer } = useAnimations(animations, group);
  const secondModelRef = useRef();
  const { scene: secondModelScene } = useGLTF("a1.glb", true);
  const [showNewModel, setShowNewModel] = useState(false);

  useEffect(() => {
    actions.Animation.play();
  }, [mixer]);

  useEffect(() => {
    if (group.current && position) {
      group.current.position.set(...position);
      group.current.scale.set(0.2, 0.2, 0.2);
    }
  }, [position, scale]);

  const handleModelClick = () => {
    actions.Animation.paused = !actions.Animation.paused;
    setShowNewModel((prev) => !prev);

    if (onModelClick) {
      onModelClick();
    }
  };

  useEffect(() => {
    if (secondModelRef.current && secondModelScene) {
      secondModelRef.current.add(secondModelScene);
      secondModelRef.current.visible = showNewModel;
    }
  }, [showNewModel, secondModelScene]);

  return (
    <>
      {scene && (
        <group ref={group} onClick={handleModelClick}>
          <primitive object={scene} dispose={null} />
          <group ref={secondModelRef} />
        </group>
      )}
    </>
  );
};

export default { Model1x };