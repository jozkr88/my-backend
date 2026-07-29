
const Toolkit = ({ position, scale }) => {
  const group = useRef();
  const isDesktop = window.innerWidth > 768;
  const glbFilePath = isDesktop ? "toolkit-desktop.glb" : "toolkit-mobile.glb";
  const { scene, animations } = useGLTF(glbFilePath, true);




  useEffect(() => {
    if (group.current && position && Array.isArray(position) && position.length === 3) {
      group.current.position.set(position[0], position[1], position[2]);
      group.current.scale.set(1, 1, 1);
    }
  }, [position, scale]);

  return (
    <primitive
      ref={group}
      object={scene}
      dispose={null}
      raycast={false}
      receiveShadow={false} // Disable receiving shadows
      castShadow={false}    // Disable casting shadows
    />
  );
};

export { Toolkit };