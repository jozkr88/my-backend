// Model2x.js
import React, { useEffect } from 'react';
import { useGLTF, useAnimations, group } from '@react-three/drei';
import { ModelVisibilityProvider } from './ModelVisibilityContext';


const Model2x = ({ position, scale, onModelClick }) => {
  const { visibleModel } = useModelVisibility();
  const { scene, animations } = useGLTF("m2x.glb", true);
  const { actions, mixer } = useAnimations(animations, group);
  const secondModelRef = useRef();
  const { scene: secondModelScene } = useGLTF("a2.glb", true);

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
    setModelVisible('a2.glb'); // Set the visible model when clicking

    if (onModelClick) {
      onModelClick();
    }
  };

  useEffect(() => {
    if (secondModelRef.current && secondModelScene) {
      secondModelRef.current.add(secondModelScene);
      secondModelRef.current.visible = visibleModel === 'a2.glb';
    }
  }, [visibleModel, secondModelScene]);

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

export { Model2x };
