import { getMeetJozVoiceLayer } from "../../world-model/meetJoz";

export function MeetJozPortal({
  FrameComponent,
  regularFont,
  mediumFont,
  World8Component,
  World8MobileComponent,
  FadableModel2Component,
  stabilizePortalAlphaMaterial,
  DiscoverParticleBlobComponent,
  ControlledGLBComponent,
  FadableModel4Component,
  FadableModel3Component,
  PillBurstMetaballsComponent,
  isMeetJozActive,
  setMeetJozPortalBlend,
  isMobile,
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
}) {
  const meetJozLayer = getMeetJozVoiceLayer(
    meetJozCurrentMesh,
    meetJozCurrentStage
  );
  const discoverBlobActive =
    isMeetJozDiscoverActive || showModel4 || meetJozLayer === "skills";
  const discoverBlobBlend = discoverBlobActive
    ? Math.max(meetJozPortalBlend, showModel4 ? 1 : 0)
    : meetJozPortalBlend;

  return (
    <FrameComponent
      id="meet-joz"
      name=""
      bg="#000000"
      position={[0, -1.8089999, -1]}
      rotation={[0, 0, 0]}
      blend={isMeetJozActive ? 1 : 0}
      onBlendChange={setMeetJozPortalBlend}
      regularFont={regularFont}
      mediumFont={mediumFont}
    >
      {isMobile ? (
        <>
          <PillBurstMetaballsComponent
            position={[0, 0, -2]}
            scale={0.9}
            speed={3.6}
            pauseInPortal={false}
            activePortalId="meet-joz"
            visible={showMeetJozMetaballs}
            sourceWorldPoint={[0, -0.34, -2]}
            revealProgress={meetJozMetaballsProgress}
          />
          <World8MobileComponent
            fadeIn={world8Active}
            inDuration={2}
            outDuration={0.8}
            inDelay={1.6}
            outDelay={0}
            forcedOpacity={world8Opacity}
            showBackground={showMeetJozEnvBackground || showModel4}
            onReadableBackdropChange={setMeetJozReadableBackdrop}
          />
        </>
      ) : (
        <>
          <PillBurstMetaballsComponent
            position={[0, 0, -2]}
            scale={0.9}
            speed={3.6}
            pauseInPortal={false}
            activePortalId="meet-joz"
            visible={showMeetJozMetaballs}
            sourceWorldPoint={[0, -0.34, -2]}
            revealProgress={meetJozMetaballsProgress}
          />
          <World8Component
            fadeIn={world8Active}
            inDuration={2}
            outDuration={0.8}
            inDelay={0}
            outDelay={0}
            forcedOpacity={world8Opacity}
            showBackground={showMeetJozEnvBackground || showModel4 || isMeetJozDiscoverActive}
            onReadableBackdropChange={setMeetJozReadableBackdrop}
          />
          <FadableModel2Component
            stabilizePortalAlphaMaterial={stabilizePortalAlphaMaterial}
            portalId="meet-joz"
            url="worldx.glb"
            position={[0, -0.7, -2]}
            scale={[1, 1, 1]}
            isVisible={showModel2}
            duration={0.9}
            outDuration={1}
            inDelay={worldxInDelay}
            outDelay={0.1}
            targetOpacity={0.2}
          />
        </>
      )}

      <DiscoverParticleBlobComponent
        active={discoverBlobActive}
        portalBlend={discoverBlobBlend}
      />

      <ambientLight intensity={5} />
      <directionalLight intensity={0} position={[0, 20, 2]} />

      <ControlledGLBComponent
        portalId="meet-joz"
        url="/model1.glb"
        fps={24}
        defaultClipName="Animation"
        fitSize={150}
        onVibeClick={handleVibeClick}
        onVibeRest={applyMeetJozFlexRestState}
        onDiscoverClick={handleDiscoverClick}
        onVoiceReadyChange={setMeetJozVoiceReady}
        onDiscoverActiveChange={setIsMeetJozDiscoverActive}
        onMetaballsVisibleChange={setShowMeetJozMetaballs}
        onMetaballsProgressChange={setMeetJozMetaballsProgress}
        onBackClick={handleBackClick}
        onSkillsClick={handleSkillsClick}
        onBack1Click={handleBack1Click}
        onWorkStepExitStart={hideMeetJozWorkStepVisuals}
        onWorld8ExitStart={hideMeetJozWorld8Visuals}
        onWorldxExitAtRewindTime={hideMeetJozWorldxVisuals}
        onWorldxEnterAtRewindTime={showMeetJozWorldxVisuals}
        onDigitalTwinToggle={handleDigitalTwinToggle}
        isWorkStepVisible={showModel4}
        isWorkStepActive={isWorkStepInteractive}
      />

      <FadableModel4Component
        stabilizePortalAlphaMaterial={stabilizePortalAlphaMaterial}
        portalId="meet-joz"
        key={resetCounter}
        url="/workf.glb"
        position={[0, -0.7, -2]}
        scale={[1, 1, 1]}
        isVisible={showModel4}
        duration={0.18}
        renderOrder={1}
        resumeFromSkills={resumeFromSkills}
        pauseFromBack1={pauseFromBack1}
        toggleJkxRef={toggleJkxRef}
        onInteractiveReadyChange={setIsWorkStepInteractive}
      />

      <FadableModel3Component
        key={`aurx-${triggerCount}`}
        portalId="meet-joz"
        url="/aurx.glb"
        isVisible={showModel3}
        mode={modeForAurx}
        trigger={triggerCount}
        playbackRange={[60, 20]}
        fps={24}
        duration={0.9}
        outDuration={0.9}
        inDelay={0}
        outDelay={aurxOutDelay}
        playbackDelay={aurxPlaybackDelay}
      />
    </FrameComponent>
  );
}
