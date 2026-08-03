import { Canvas } from "@react-three/fiber";
import { Center, Gltf } from "@react-three/drei";

import Metaballs, { PillBurstMetaballs } from "../../Metaballs";
import { assetUrl } from "../../utils/paths";
import { stabilizePortalAlphaMaterial } from "../../utils/materials";
import { jozSpeak } from "../../utils/voice";
import { ControlledGLB } from "../meet-joz/ControlledGLB";
import { DiscoverParticleBlob } from "../meet-joz/DiscoverParticleBlob";
import { FadableModel2 } from "../meet-joz/FadableModel2";
import { FadableModel3 } from "../meet-joz/FadableModel3";
import { FadableModel4 } from "../meet-joz/FadableModel4";
import { MeetJozPortal } from "../meet-joz/MeetJozPortal";
import { World8, World8m } from "../meet-joz/World8";
import { AnimatedModel, AnimatedModelMobile, Aura, Model1 } from "../maxx/components";
import { MaxxPortal } from "../maxx/MaxxPortal";
import { World2 } from "../maxx/World2";
import { World9 } from "../maxx/World9";
import { BX } from "./BX";
import { Ball } from "./Ball";
import { BallHudOverlay } from "./BallHudOverlay";
import { Frame } from "./Frame";
import { GpuWarmup } from "./gpuWarmup";
import { InitialFrameSignal } from "./InitialFrameSignal";
import { Rig } from "./Rig";
import { SceneObservationBridge } from "./SceneObservationBridge";
import { VibeWord } from "./VibeWord";

const regular = import("../../fontx.ttf");
const medium = import("../../fontx.ttf");

export function AppSceneCanvas({
  onSceneReady,
  isMobile,
  shouldWarmup,
  currentPortal,
  shouldMountBallHud,
  ballOpacityTargetRef,
  handleBallPortalOpen,
  isMeetJozActive,
  showMeetJozMetaballs,
  meetJozMetaballsProgress,
  world8Active,
  world8Opacity,
  showMeetJozEnvBackground,
  showModel4,
  setMeetJozReadableBackdrop,
  isMeetJozDiscoverActive,
  showModel2,
  worldxInDelay,
  meetJozPortalBlend,
  setMeetJozPortalBlend,
  meetJozCurrentMesh,
  meetJozCurrentStage,
  handleVibeClick,
  applyMeetJozFlexRestState,
  handleDiscoverClick,
  setMeetJozVoiceReady,
  setIsMeetJozDiscoverActive,
  setShowMeetJozMetaballs,
  setMeetJozMetaballsProgress,
  handleBackClick,
  handleSkillsClick,
  handleBack1Click,
  hideMeetJozWorkStepVisuals,
  hideMeetJozWorld8Visuals,
  hideMeetJozWorldxVisuals,
  showMeetJozWorldxVisuals,
  handleDigitalTwinToggle,
  isWorkStepInteractive,
  resetCounter,
  resumeFromSkills,
  pauseFromBack1,
  toggleJkxRef,
  setIsWorkStepInteractive,
  showModel3,
  modeForAurx,
  aurxOutDelay,
  aurxPlaybackDelay,
  triggerCount,
  isHelpPanelHovered,
  sceneBlur = 0,
}) {
  return (
    <Canvas
      flat
      camera={{ fov: 75, position: [0, 0, 20] }}
      dpr={isMobile ? [1, 1.1] : [1, 1.25]}
      gl={{
        antialias: !isMobile,
        alpha: true,
        powerPreference: isMobile ? "low-power" : "high-performance",
      }}
      eventSource={document.body}
      eventPrefix="client"
      style={{
        background: "#000000",
        filter: `blur(${Math.max(0, Number(sceneBlur) || 0)}px)`,
        willChange: sceneBlur ? "filter" : "auto",
      }}
    >
        {shouldWarmup && !isMobile && <GpuWarmup portalKey={currentPortal} />}
      <InitialFrameSignal onReady={onSceneReady} />
      <SceneObservationBridge
        currentPortal={currentPortal}
        currentStage={meetJozCurrentStage}
        currentMesh={meetJozCurrentMesh}
      />
      <Center position={[0, 0, 3]} rotation={[0, Math.PI, 0]}>
        <VibeWord scale={1} />
      </Center>
      <Metaballs pauseInPortal speed={3.6} />

      <World9 />

      <ambientLight intensity={5} />
      <directionalLight intensity={5} position={[0, -4, -2]} />
      <directionalLight intensity={5} position={[0, -1, 7]} />

      <Gltf
        src={assetUrl("/enter.glb")}
        scale={0.11}
        position={[0, 0.3, 0.66]}
        onLoad={(gltf) => {
          gltf.scene.traverse((obj) => {
            if (obj.isMesh && obj.name.toLowerCase().includes("enter")) {
              obj.userData = {
                action: "portal",
                context: { target: "/neo/maxx" },
                commands: [
                  "enter",
                  "explore",
                  "go inside",
                  "open portal",
                  "open the flex",
                ],
              };
            }
          });
        }}
      />

      {shouldMountBallHud && (
        <BallHudOverlay
          BallComponent={Ball}
          opacityTargetRef={ballOpacityTargetRef}
          onActivate={handleBallPortalOpen}
          onLoad={(gltf) => {
            gltf.scene.traverse((obj) => {
              if (obj.isMesh && obj.name.toLowerCase().includes("meet joz")) {
                obj.userData = {
                  action: "portal",
                  context: { target: "/neo/meet-joz" },
                  commands: ["meet joz", "neo meet joz", "joz", "meet", "jaws", "jos"],
                };
              }
            });
          }}
        />
      )}

      <Aura position={[0, 0, 17]} />

      <BX
        stabilizePortalAlphaMaterial={stabilizePortalAlphaMaterial}
        onSpeak={jozSpeak}
        onLoad={(gltf) => {
          gltf.scene.traverse((obj) => {
            if (obj.isMesh) {
              obj.userData = {
                action: "portal",
                context: { target: "/neo/maxx" },
                commands: ["enter", "open flex", "go inside"],
              };
            }
          });
        }}
      />

      <MaxxPortal
        FrameComponent={Frame}
        regularFont={regular}
        mediumFont={medium}
        World2Component={World2}
        Model1Component={Model1}
        AnimatedModelComponent={AnimatedModel}
        AnimatedModelMobileComponent={AnimatedModelMobile}
        isMobile={isMobile}
      />

      <MeetJozPortal
        FrameComponent={Frame}
        regularFont={regular}
        mediumFont={medium}
        World8Component={World8}
        World8MobileComponent={World8m}
        FadableModel2Component={FadableModel2}
        stabilizePortalAlphaMaterial={stabilizePortalAlphaMaterial}
        DiscoverParticleBlobComponent={DiscoverParticleBlob}
        ControlledGLBComponent={ControlledGLB}
        FadableModel4Component={FadableModel4}
        FadableModel3Component={FadableModel3}
        PillBurstMetaballsComponent={PillBurstMetaballs}
        isMeetJozActive={isMeetJozActive}
        setMeetJozPortalBlend={setMeetJozPortalBlend}
        isMobile={isMobile}
        showMeetJozMetaballs={showMeetJozMetaballs}
        meetJozMetaballsProgress={meetJozMetaballsProgress}
        world8Active={world8Active}
        world8Opacity={world8Opacity}
        showMeetJozEnvBackground={showMeetJozEnvBackground}
        showModel4={showModel4}
        setMeetJozReadableBackdrop={setMeetJozReadableBackdrop}
        isMeetJozDiscoverActive={isMeetJozDiscoverActive}
        showModel2={showModel2}
        worldxInDelay={worldxInDelay}
        meetJozPortalBlend={meetJozPortalBlend}
        meetJozCurrentMesh={meetJozCurrentMesh}
        meetJozCurrentStage={meetJozCurrentStage}
        handleVibeClick={handleVibeClick}
        applyMeetJozFlexRestState={applyMeetJozFlexRestState}
        handleDiscoverClick={handleDiscoverClick}
        setMeetJozVoiceReady={setMeetJozVoiceReady}
        setIsMeetJozDiscoverActive={setIsMeetJozDiscoverActive}
        setShowMeetJozMetaballs={setShowMeetJozMetaballs}
        setMeetJozMetaballsProgress={setMeetJozMetaballsProgress}
        handleBackClick={handleBackClick}
        handleSkillsClick={handleSkillsClick}
        handleBack1Click={handleBack1Click}
        hideMeetJozWorkStepVisuals={hideMeetJozWorkStepVisuals}
        hideMeetJozWorld8Visuals={hideMeetJozWorld8Visuals}
        hideMeetJozWorldxVisuals={hideMeetJozWorldxVisuals}
        showMeetJozWorldxVisuals={showMeetJozWorldxVisuals}
        handleDigitalTwinToggle={handleDigitalTwinToggle}
        isWorkStepInteractive={isWorkStepInteractive}
        resetCounter={resetCounter}
        resumeFromSkills={resumeFromSkills}
        pauseFromBack1={pauseFromBack1}
        toggleJkxRef={toggleJkxRef}
        setIsWorkStepInteractive={setIsWorkStepInteractive}
        showModel3={showModel3}
        modeForAurx={modeForAurx}
        aurxOutDelay={aurxOutDelay}
        aurxPlaybackDelay={aurxPlaybackDelay}
        triggerCount={triggerCount}
      />

        <Rig disableInteraction={isHelpPanelHovered} />
    </Canvas>
  );
}
