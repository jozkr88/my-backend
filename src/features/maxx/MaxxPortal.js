import { Suspense } from "react";

export function MaxxPortal({
  FrameComponent,
  regularFont,
  mediumFont,
  World2Component,
  Model1Component,
  AnimatedModelComponent,
  AnimatedModelMobileComponent,
  isMobile,
}) {
  return (
    <FrameComponent
      id="maxx"
      name=""
      bg="#000000"
      position={[0, 0.4, 0.75]}
      blend={1}
      regularFont={regularFont}
      mediumFont={mediumFont}
    >
      <World2Component backgroundIntensity={0.1} environmentIntensity={0.1} />

      <ambientLight intensity={5} />
      <directionalLight intensity={10} position={[0, 10, 3]} />
      <directionalLight intensity={13} position={[10, -4, -5]} />
      <directionalLight intensity={0.3} position={[6, -15, 10]} />
      <directionalLight intensity={0.3} position={[-30, -10, 1]} />

      <Model1Component portalId="maxx" position={[0, -0.9, 0]} scale={1} />

      <Suspense fallback={null}>
        {isMobile ? (
          <AnimatedModelMobileComponent
            portalId="maxx"
            position={[0, -0.78, -2]}
            scale={[0.0135, 0.0135, 0.0135]}
          />
        ) : (
          <AnimatedModelComponent
            portalId="maxx"
            position={[0, -0.78, -2]}
            scale={[0.0135, 0.0135, 0.0135]}
          />
        )}
      </Suspense>
    </FrameComponent>
  );
}
