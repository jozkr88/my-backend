import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { useRoute, useLocation } from 'wouter';

import "./bootstrap/sceneGlobals";
import "./bootstrap/gltfLoaderConfig";
import "./bootstrap/voiceModelRegistry";

import { useARSupport } from "./hooks/useARSupport";
import { useAppOrchestration } from "./hooks/useAppOrchestration";
import { useAgentShell } from "./hooks/useAgentShell";
import { useGpuWarmupSchedule } from "./hooks/useGpuWarmupSchedule";
import { usePortalModelPreload } from "./hooks/usePortalModelPreload";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";


import { llmClient } from "./utils/llmClient";
import { tools } from "./utils/tools";
import { apiFetch, apiUrl, fetchJson } from "./utils/api";
import {
  detectImmediateMobileCommand,
  resolveLocalVoiceCommand,
} from "./voice/localVoice";

import { buildAgentContext } from "./features/voice/context";
import { useContactCta } from "./features/voice/useContactCta";
import { VoiceChrome } from "./features/voice/VoiceChrome";
import { useVoiceMicrophoneController } from "./features/voice/useVoiceMicrophoneController";
import { useVoiceUiControls } from "./features/voice/useVoiceUiControls";
import { useJozLlm } from "./features/voice/useJozLlm";
import { applyVoiceReasoningResult } from "./features/voice/applyVoiceReasoningResult";
import { useAgentWorldState } from "./features/voice/useAgentWorldState";
import { useVoiceHudStatus } from "./features/voice/useVoiceHudStatus";
import { useVoiceDebugState } from "./features/voice/useVoiceDebugState";
import { AppSceneCanvas } from "./features/root/AppSceneCanvas";
import { EdgeGlowOverlay } from "./features/root/EdgeGlowOverlay";
import {
  DESKTOP_ONLY_MODELS,
  PORTAL_PRELOAD_MODELS,
  ROOT_WARMUP_MODELS,
} from "./features/root/gpuWarmup";
import { useBallPortalHud } from "./features/root/useBallPortalHud";
import { useAppRuntimeState } from "./state/useAppRuntimeState";
import { JozLlmDashboardPage } from "./features/joz-llm/JozLlmDashboardPage";
import { WorldPlacementLayer } from "./features/world-model/WorldPlacementLayer";


import { worldMap } from "./data/worldMap";
import { ReactComponent as VoiceMaxxSvg } from "./voice-maxx.svg";
import moveTheWorldsSvg from "./move-the-worlds.svg";
import justSaySvg from "./just-say.svg";
import slide1Svg from "./slide1.svg";
import slide2Svg from "./slide2.svg";
import slide3Svg from "./slide3.svg";


const HELP_SLIDES = [
  { src: slide1Svg, width: "100%" },
  { src: slide2Svg, width: "95%" },
  { src: slide3Svg, width: "95%" },
];

export const App = ({ onSceneReady, isInitialLoading = false }) => {
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    browserSupportsContinuousListening,
    isMicrophoneAvailable,
  } = useSpeechRecognition();
  const [, params] = useRoute("/neo/:id");
  const [isJozLlmDashboard] = useRoute("/joz-llm-dashboard");
  const [, setLocation] = useLocation();

  const [suggestionText, setSuggestionText] = useState("");
  const [micEnabled, setMicEnabled] = useState(false);
  const [voiceProcessLine, setVoiceProcessLine] = useState("");
  const [pendingMeetJozVoiceAction, setPendingMeetJozVoiceAction] =
    useState("");
  const [meetJozVoiceReady, setMeetJozVoiceReady] = useState(false);
  const [agentCurrentMesh, setAgentCurrentMesh] = useState(
    typeof window !== "undefined" ? window.__currentMesh || null : null
  );
  const [agentCurrentMeshStage, setAgentCurrentMeshStage] = useState(
    typeof window !== "undefined" ? window.__currentMeshStage || null : null
  );
  const [agentCurrentPhase, setAgentCurrentPhase] = useState(
    typeof window !== "undefined" ? window.__maxxPhase || null : null
  );
  const [agentState, setAgentState] = useState({
    userSpeech: "",
    context: {},
    contextUpdate: false,
  });

  const pendingPortalActionRef = useRef(null);
  const lastPortalRef = useRef("");
  const micEnabledRef = useRef(false);
  const agentButtonRef = useRef(null);

  const currentPortal = params?.id || "root";
  const { isMobile, ar } = useARSupport();
  const shouldWarmup = useGpuWarmupSchedule({ isInitialLoading });
  const HELP_FADE_DURATION_MS = 320;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const root = document.documentElement;
    const viewport = window.visualViewport;

    const syncViewportVars = () => {
      const viewportHeight = viewport?.height ?? window.innerHeight;

      root.style.setProperty("--app-viewport-height", `${viewportHeight}px`);
    };

    syncViewportVars();

    if (!viewport) {
      window.addEventListener("resize", syncViewportVars);
      window.addEventListener("orientationchange", syncViewportVars);

      return () => {
        window.removeEventListener("resize", syncViewportVars);
        window.removeEventListener("orientationchange", syncViewportVars);
      };
    }

    viewport.addEventListener("resize", syncViewportVars);
    viewport.addEventListener("scroll", syncViewportVars);
    window.addEventListener("orientationchange", syncViewportVars);

    return () => {
      viewport.removeEventListener("resize", syncViewportVars);
      viewport.removeEventListener("scroll", syncViewportVars);
      window.removeEventListener("orientationchange", syncViewportVars);
    };
  }, []);

  const {
    showContactButtons,
    contactCtaType,
    contactCtaHref,
    contactCtaLabel,
    fadeOut,
    showContactCta,
    hideContactCta,
  } = useContactCta({ setSuggestionText });

  const {
    agentAwarenessLine,
    voiceStatusLine,
    setVoiceStatusLine,
    announcePortalTransition,
  } = useVoiceHudStatus({
    currentPortal,
    lastPortalRef,
  });

  usePortalModelPreload({
    currentPortal,
    isMobile,
    rootWarmupModels: ROOT_WARMUP_MODELS,
    portalPreloadModels: PORTAL_PRELOAD_MODELS,
    desktopOnlyModels: DESKTOP_ONLY_MODELS,
  });

  const isMeetJozActive = currentPortal === "meet-joz";
  const {
    shouldMountBallHud,
    ballOpacityTargetRef,
    handleBallPortalOpen,
  } = useBallPortalHud({
    currentPortal,
    announcePortalTransition,
    setLocation,
  });

  const {
    nativeTranscript,
    setNativeTranscript,
    nativeListening,
    micError,
    micInputSupported,
    startMicListening,
    stopMicListening,
  } = useVoiceMicrophoneController({
    isMobile,
    browserSupportsSpeechRecognition,
    browserSupportsContinuousListening,
    isMicrophoneAvailable,
    detectImmediateMobileCommand,
    apiFetch,
    apiUrl,
    SpeechRecognition,
    micEnabled,
  });
  const effectiveTranscript = isMobile ? nativeTranscript : transcript;
  const effectiveListening = isMobile ? nativeListening : listening;

  const {
    voiceDebugEvent,
    setVoiceDebugEvent,
    pushVoiceDebugEvent,
    appendVoiceSessionEntry,
    finalizeVoiceSessionEntry,
  } = useVoiceDebugState({
    currentPortal,
    effectiveListening,
    setVoiceProcessLine,
    setVoiceStatusLine,
  });

  const {
    voiceHintsEnabled,
    isHelpOpen,
    isHelpRendered,
    isHelpVisible,
    isHelpPanelHovered,
    helpSlideIndex,
    setHelpSlideIndex,
    handleAgentButtonClick,
    toggleHelp,
    closeHelp,
    handleHelpOverlayClick,
    handleHelpPanelPointerEnter,
    handleHelpPanelPointerLeave,
    handleHelpSlideTouchStart,
    handleHelpSlideTouchEnd,
  } = useVoiceUiControls({
    currentPortal,
    effectiveListening,
    isMicrophoneAvailable,
    isMobile,
    micEnabled,
    setMicEnabled,
    startMicListening,
    stopMicListening,
    helpFadeDurationMs: HELP_FADE_DURATION_MS,
  });

  useAgentWorldState({
    currentPortal,
    setAgentCurrentMesh,
    setAgentCurrentMeshStage,
    setAgentCurrentPhase,
  });

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  useEffect(() => {
    console.log("🎙️ Transcript from browser:", effectiveTranscript);
  }, [effectiveTranscript]);

  const appRuntimeState = useAppRuntimeState({
    currentPortal,
    currentMesh: agentCurrentMesh,
    currentMeshStage: agentCurrentMeshStage,
    currentPath: typeof window !== "undefined" ? window.location.pathname : "/",
    showContactButtons,
    micEnabled,
    effectiveListening,
    micError,
    isHelpOpen,
    ar,
    isMobile,
    effectiveTranscript,
    suggestionText,
    currentPhase: agentCurrentPhase,
  });

  const agentContext = useMemo(
    () => buildAgentContext({ appState: appRuntimeState }),
    [appRuntimeState]
  );

  const executeJozLlmCommand = useCallback(
    (result) => {
      applyVoiceReasoningResult({
        result,
        spoken: "",
        source: "joz-llm",
        isMobile,
        currentPortal,
        currentMesh: agentCurrentMesh,
        currentMeshStage: agentCurrentMeshStage,
        announcePortalTransition,
        setLocation,
        showContactCta,
        hideContactCta,
        setPendingMeetJozVoiceAction,
        dispatchAppAction:
          typeof window !== "undefined" ? window.__dispatchAppAction : undefined,
      });
    },
    [
      agentCurrentMesh,
      agentCurrentMeshStage,
      announcePortalTransition,
      currentPortal,
      hideContactCta,
      isMobile,
      setLocation,
      showContactCta,
    ]
  );

  const {
    isOpen: isJozLlmOpen,
    activeIntentMode: jozLlmActiveIntentMode,
    selectIntentMode: selectJozLlmIntentMode,
    toggle: toggleJozLlm,
    close: closeJozLlm,
    messages: jozLlmMessages,
    input: jozLlmInput,
    setInput: setJozLlmInput,
    isLoading: isJozLlmLoading,
    error: jozLlmError,
    isCoolingDown: jozLlmCoolingDown,
    cooldownSeconds: jozLlmCooldownSeconds,
    cooldownProgress: jozLlmCooldownProgress,
    suggestions: jozLlmSuggestions,
    bookingPrompt: jozLlmBookingPrompt,
    startGetCalledFlow,
    sendMessage: sendJozLlmMessage,
    stopGeneration: stopJozLlmGeneration,
    handleSubmit: jozLlmHandleSubmit,
  } = useJozLlm({
    currentPortal,
    currentMesh: agentCurrentMesh,
    currentMeshStage: agentCurrentMeshStage,
    executeCommand: executeJozLlmCommand,
    isMobile,
    arSupported: ar,
    startOpen: true,
  });

useAgentShell({
  effectiveTranscript,
  agentState,
  setAgentState,
  apiFetch,
  apiUrl,
  fetchJson,
  worldMap,
  llmClient,
  tools,
});
  const meetJozState = useAppOrchestration({
    currentPortal,
    lastPortal: lastPortalRef.current,
    agentCurrentMesh,
    agentCurrentMeshStage,
    agentCurrentPhase,
    pendingMeetJozVoiceAction,
    meetJozVoiceReady,
    setMeetJozVoiceReady,
    setPendingMeetJozVoiceAction,
    micEnabledRef,
    effectiveListening,
    effectiveTranscript,
    isJozLlmOpen,
    sendJozLlmMessage,
    voiceDebugEvent,
    setVoiceDebugEvent,
    pushVoiceDebugEvent,
    appendVoiceSessionEntry,
    finalizeVoiceSessionEntry,
    voiceProcessLine,
    voiceStatusLine,
    agentAwarenessLine,
    isMobile,
    ar,
    showContactButtons,
    hideContactCta,
    showContactCta,
    announcePortalTransition,
    setLocation,
    handleBallPortalOpen,
    pendingPortalActionRef,
    agentContext,
    detectImmediateMobileCommand,
    resolveLocalVoiceCommand,
    fetchJson,
    apiUrl,
    setVoiceProcessLine,
    setNativeTranscript,
    resetTranscript,
    setAgentCurrentMesh,
  });

  const {
    showModel2,
    showModel3,
    world8Active,
    showMeetJozMetaballs,
    setShowMeetJozMetaballs,
    meetJozMetaballsProgress,
    setMeetJozMetaballsProgress,
    isMeetJozDiscoverActive,
    setIsMeetJozDiscoverActive,
    showMeetJozEnvBackground,
    meetJozPortalBlend,
    setMeetJozPortalBlend,
    world8Opacity,
    worldxInDelay,
    showModel4,
    isWorkStepInteractive,
    setIsWorkStepInteractive,
    setMeetJozReadableBackdrop,
    modeForAurx,
    aurxOutDelay,
    triggerCount,
    resetCounter,
    toggleJkxRef,
    resumeFromSkills,
    pauseFromBack1,
    voiceSuggestionPrimaryLine,
    voiceSuggestionSecondaryLine,
    voiceSuggestionTertiaryLine,
    voiceSuggestionQuaternaryLine,
    useDarkVoiceSuggestions,
    applyMeetJozFlexRestState,
    hideMeetJozWorkStepVisuals,
    hideMeetJozWorld8Visuals,
    hideMeetJozWorldxVisuals,
    showMeetJozWorldxVisuals,
    handleDigitalTwinToggle,
    handleVibeClick,
    handleBackClick,
    handleDiscoverClick,
    handleSkillsClick,
    handleBack1Click,
  } = meetJozState;

  const showAgentButton = true;
  if (isJozLlmDashboard) {
    return <JozLlmDashboardPage />;
  }

  return (
    <>

      <VoiceChrome
        AgentIcon={VoiceMaxxSvg}
        moveTheWorldsSrc={moveTheWorldsSvg}
        justSaySrc={justSaySvg}
        helpSlides={HELP_SLIDES}
        voiceHintsEnabled={voiceHintsEnabled}
        voiceSuggestionPrimaryLine={voiceSuggestionPrimaryLine}
        voiceSuggestionSecondaryLine={voiceSuggestionSecondaryLine}
        voiceSuggestionTertiaryLine={voiceSuggestionTertiaryLine}
        voiceSuggestionQuaternaryLine={voiceSuggestionQuaternaryLine}
        useDarkVoiceSuggestions={useDarkVoiceSuggestions}
        showAgentButton={showAgentButton}
        agentButtonRef={agentButtonRef}
        handleAgentButtonClick={handleAgentButtonClick}
        effectiveListening={effectiveListening}
        isHelpOpen={isHelpOpen}
        toggleHelp={toggleHelp}
        isHelpRendered={isHelpRendered}
        isHelpVisible={isHelpVisible}
        handleHelpOverlayClick={handleHelpOverlayClick}
        handleHelpPanelPointerEnter={handleHelpPanelPointerEnter}
        handleHelpPanelPointerLeave={handleHelpPanelPointerLeave}
        closeHelp={closeHelp}
        handleHelpSlideTouchStart={handleHelpSlideTouchStart}
        handleHelpSlideTouchEnd={handleHelpSlideTouchEnd}
        helpSlideIndex={helpSlideIndex}
        setHelpSlideIndex={setHelpSlideIndex}
        micError={micError}
        showContactButtons={showContactButtons}
        contactCtaHref={contactCtaHref}
        contactCtaLabel={contactCtaLabel}
        contactCtaType={contactCtaType}
        fadeOut={fadeOut}
        currentPortal={currentPortal}
        isMobile={isMobile}
        arSupported={ar}
        agentContext={agentContext}
        isJozLlmOpen={isJozLlmOpen}
        jozLlmActiveIntentMode={jozLlmActiveIntentMode}
        selectJozLlmIntentMode={selectJozLlmIntentMode}
        toggleJozLlm={toggleJozLlm}
        closeJozLlm={closeJozLlm}
        jozLlmMessages={jozLlmMessages}
        jozLlmInput={jozLlmInput}
        setJozLlmInput={setJozLlmInput}
        jozLlmLoading={isJozLlmLoading}
        jozLlmError={jozLlmError}
        jozLlmCoolingDown={jozLlmCoolingDown}
        jozLlmCooldownSeconds={jozLlmCooldownSeconds}
        jozLlmCooldownProgress={jozLlmCooldownProgress}
        jozLlmSuggestions={jozLlmSuggestions}
        jozLlmBookingPrompt={jozLlmBookingPrompt}
        startGetCalledFlow={startGetCalledFlow}
        sendJozLlmMessage={sendJozLlmMessage}
        stopJozLlmGeneration={stopJozLlmGeneration}
        handleJozLlmSubmit={jozLlmHandleSubmit}
      />

  <AppSceneCanvas
    onSceneReady={onSceneReady}
    isMobile={isMobile}
    shouldWarmup={shouldWarmup}
    currentPortal={currentPortal}
    shouldMountBallHud={shouldMountBallHud}
    ballOpacityTargetRef={ballOpacityTargetRef}
    handleBallPortalOpen={handleBallPortalOpen}
    isMeetJozActive={isMeetJozActive}
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
    setMeetJozPortalBlend={setMeetJozPortalBlend}
    meetJozCurrentMesh={agentCurrentMesh}
    meetJozCurrentStage={agentCurrentMeshStage}
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
    triggerCount={triggerCount}
    isHelpPanelHovered={isHelpPanelHovered}
  />

  <WorldPlacementLayer />

  <Canvas
    className="edge-glow-overlay-canvas"
    flat
    dpr={[1, 1.25]}
    gl={{ alpha: true, antialias: true }}
    style={{ background: "transparent" }}
  >
    <EdgeGlowOverlay active={micEnabled} />
  </Canvas>

  </>
  );
};
