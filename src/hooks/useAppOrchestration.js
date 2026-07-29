import { useCallback, useEffect, useRef } from "react";

import { applyVoiceReasoningResult } from "../features/voice/applyVoiceReasoningResult";
import { useAgentActionBridge } from "../features/voice/useAgentActionBridge";
import { useDeferredMeetJozPortalAction } from "../features/voice/useDeferredMeetJozPortalAction";
import { useVoiceSuggestionState } from "../features/voice/useVoiceSuggestionState";
import { useVoiceTranscriptPipeline } from "../features/voice/useVoiceTranscriptPipeline";
import { useVoiceWindowBridge } from "../features/voice/useVoiceWindowBridge";
import { useMeetJozController } from "../features/meet-joz/useMeetJozController";
import { useMeetJozRuntime } from "../features/meet-joz/useMeetJozRuntime";
import { useMeetJozVoiceSync } from "../features/meet-joz/useMeetJozVoiceSync";
import { APP_ACTIONS } from "../state/actionTypes";
import { useAppActionDispatcher } from "../state/useAppActionDispatcher";
import { setCurrentMeshContext } from "../world-model/runtimeContext";

export function useAppOrchestration({
  currentPortal,
  lastPortal,
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
}) {
  const {
    showModel2,
    setShowModel2,
    showModel3,
    setShowModel3,
    world8Active,
    setWorld8Active,
    showMeetJozMetaballs,
    setShowMeetJozMetaballs,
    meetJozMetaballsProgress,
    setMeetJozMetaballsProgress,
    isMeetJozDiscoverActive,
    setIsMeetJozDiscoverActive,
    showMeetJozEnvBackground,
    setShowMeetJozEnvBackground,
    meetJozPortalBlend,
    setMeetJozPortalBlend,
    world8Opacity,
    setWorld8Opacity,
    worldxInDelay,
    setWorldxInDelay,
    showModel4,
    setShowModel4,
    isWorkStepInteractive,
    setIsWorkStepInteractive,
    meetJozReadableBackdrop,
    setMeetJozReadableBackdrop,
    modeForAurx,
    setModeForAurx,
    triggerCount,
    setTriggerCount,
    aurxOutDelay,
    setAurxOutDelay,
    aurxPlaybackDelay,
    setAurxPlaybackDelay,
    forcedOpacity,
    setForcedOpacity,
    resetCounter,
    setResetCounter,
    toggleJkxRef,
    resumeFromSkills,
    pauseFromBack1,
    pendingJkxOpenRef,
  } = useMeetJozRuntime();

  const forceMeetJozVibeStateRef = useRef(() => {});
  const forceMeetJozDiscoverStateRef = useRef(() => {});
  const forceMeetJozSkillsStateRef = useRef(() => {});
  const forceMeetJozBack1StateRef = useRef(() => {});

  useEffect(() => {
    if (!showContactButtons) return;

    const isSupportedPortal =
      currentPortal === "meet-joz" ||
      currentPortal === "root" ||
      currentPortal === "maxx" ||
      currentPortal === "the-vibe-energy";

    if (isSupportedPortal) return;
    hideContactCta(0);
  }, [currentPortal, hideContactCta, showContactButtons]);

  const {
    voiceSuggestionPrimaryLine,
    voiceSuggestionSecondaryLine,
    voiceSuggestionTertiaryLine,
    voiceSuggestionQuaternaryLine,
    useDarkVoiceSuggestions,
  } = useVoiceSuggestionState({
    currentPortal,
    lastPortal,
    agentCurrentMesh,
    agentCurrentMeshStage,
    agentCurrentPhase,
    pendingMeetJozVoiceAction,
    showModel2,
    showModel3,
    showModel4,
    world8Active,
    isMeetJozDiscoverActive,
    isWorkStepInteractive,
    effectiveListening,
    effectiveTranscript,
    voiceDebugEvent,
    voiceProcessLine,
    voiceStatusLine,
    agentAwarenessLine,
    isMobile,
    ar,
    meetJozReadableBackdrop,
    setMeetJozReadableBackdrop,
  });

  const {
    syncMeetJozClickAction,
    getCurrentMeetJozLayer,
    syncMeetJozSemanticCommand,
  } = useMeetJozVoiceSync({
    micEnabledRef,
    effectiveListening,
    voiceDebugEventRawInput: voiceDebugEvent.rawInput,
    pendingMeetJozVoiceAction,
    currentPortal,
    agentCurrentMesh,
    agentCurrentMeshStage,
    showModel2,
    showModel3,
    showModel4,
    world8Active,
    isMeetJozDiscoverActive,
    isWorkStepInteractive,
    setVoiceDebugEvent,
    pushVoiceDebugEvent,
  });

  const {
    applyMeetJozFlexRestState,
    hideMeetJozWorkStepVisuals,
    hideMeetJozWorld8Visuals,
    hideMeetJozWorldxVisuals,
    showMeetJozWorldxVisuals,
    handleVibeClick: rawHandleVibeClick,
    handleBackClick: rawHandleBackClick,
    handleDiscoverClick: rawHandleDiscoverClick,
    handleDigitalTwinToggle,
    handleSkillsClick: rawHandleSkillsClick,
    handleBack1Click: rawHandleBack1Click,
  } = useMeetJozController({
    currentPortal,
    runtime: {
      showModel2,
      setShowModel2,
      showModel3,
      setShowModel3,
      world8Active,
      setWorld8Active,
      setShowMeetJozMetaballs,
      setMeetJozMetaballsProgress,
      setIsMeetJozDiscoverActive,
      setShowMeetJozEnvBackground,
      setMeetJozPortalBlend,
      setWorld8Opacity,
      setWorldxInDelay,
      showModel4,
      setShowModel4,
      isWorkStepInteractive,
      setIsWorkStepInteractive,
      setModeForAurx,
      setTriggerCount,
      setAurxOutDelay,
      setAurxPlaybackDelay,
      setForcedOpacity,
      setResetCounter,
      toggleJkxRef,
      resumeFromSkills,
      pauseFromBack1,
      pendingJkxOpenRef,
    },
    setCurrentMeshContext,
    setAgentCurrentMesh,
    hideContactCta,
    syncMeetJozClickAction,
    syncMeetJozSemanticCommand,
    getCurrentMeetJozLayer,
    forceMeetJozVibeStateRef,
    forceMeetJozDiscoverStateRef,
    forceMeetJozSkillsStateRef,
    forceMeetJozBack1StateRef,
  });

  const dispatchAppAction = useAppActionDispatcher({
    announcePortalTransition,
    setLocation,
    handleBallPortalOpen,
    showContactCta,
    hideContactCta,
    setPendingMeetJozVoiceAction,
    pendingPortalActionRef,
    handleVibeClick: rawHandleVibeClick,
    handleBackClick: rawHandleBackClick,
    handleDiscoverClick: rawHandleDiscoverClick,
    handleBack1Click: rawHandleBack1Click,
    handleSkillsClick: rawHandleSkillsClick,
  });

  const handleVibeClick = useCallback(
    () => dispatchAppAction(APP_ACTIONS.MEET_JOZ_FLEX),
    [dispatchAppAction]
  );
  const handleBackClick = useCallback(
    () => dispatchAppAction(APP_ACTIONS.MEET_JOZ_BACK),
    [dispatchAppAction]
  );
  const handleDiscoverClick = useCallback(
    () => dispatchAppAction(APP_ACTIONS.MEET_JOZ_DISCOVER),
    [dispatchAppAction]
  );
  const handleSkillsClick = useCallback(
    () => dispatchAppAction(APP_ACTIONS.MEET_JOZ_SKILLS),
    [dispatchAppAction]
  );
  const handleBack1Click = useCallback(
    () => dispatchAppAction(APP_ACTIONS.MEET_JOZ_BACK1),
    [dispatchAppAction]
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    window.__dispatchAppAction = dispatchAppAction;

    return () => {
      if (window.__dispatchAppAction === dispatchAppAction) {
        delete window.__dispatchAppAction;
      }
    };
  }, [dispatchAppAction]);

  useAgentActionBridge({
    currentPortal,
    dispatchAppAction,
    forceMeetJozVibeStateRef,
    forceMeetJozSkillsStateRef,
  });

  useDeferredMeetJozPortalAction({
    currentPortal,
    meetJozVoiceReady,
    pendingPortalActionRef,
    setPendingMeetJozVoiceAction,
    pendingMeetJozVoiceAction,
    forceMeetJozVibeStateRef,
    forceMeetJozDiscoverStateRef,
    forceMeetJozSkillsStateRef,
  });

  useVoiceWindowBridge({
    agentContext,
    currentPortal,
    isMobile,
    detectImmediateMobileCommand,
    resolveLocalVoiceCommand,
    fetchJson,
    apiUrl,
    pushVoiceDebugEvent,
    appendVoiceSessionEntry,
    finalizeVoiceSessionEntry,
    applyVoiceReasoningResult,
    dispatchAppAction,
    announcePortalTransition,
    setLocation,
    showContactCta,
    hideContactCta,
    setPendingMeetJozVoiceAction,
    handleVibeClick,
    handleBackClick,
    handleDiscoverClick,
    handleBack1Click,
    handleSkillsClick,
    pendingPortalActionRef,
  });

  useVoiceTranscriptPipeline({
    effectiveTranscript,
    isJozLlmOpen,
    isMobile,
    sendJozLlmMessage,
    detectImmediateMobileCommand,
    setVoiceProcessLine,
    pushVoiceDebugEvent,
    appendVoiceSessionEntry,
    finalizeVoiceSessionEntry,
    fetchJson,
    apiUrl,
    resolveLocalVoiceCommand,
    applyVoiceReasoningResult,
    dispatchAppAction,
    announcePortalTransition,
    setLocation,
    showContactCta,
    hideContactCta,
    setPendingMeetJozVoiceAction,
    handleVibeClick,
    handleBackClick,
    handleDiscoverClick,
    handleBack1Click,
    handleSkillsClick,
    pendingPortalActionRef,
    agentContext,
    setNativeTranscript,
    resetTranscript,
  });

  return {
    showModel2,
    setShowModel2,
    showModel3,
    setShowModel3,
    world8Active,
    setWorld8Active,
    showMeetJozMetaballs,
    setShowMeetJozMetaballs,
    meetJozMetaballsProgress,
    setMeetJozMetaballsProgress,
    isMeetJozDiscoverActive,
    setIsMeetJozDiscoverActive,
    showMeetJozEnvBackground,
    setShowMeetJozEnvBackground,
    meetJozPortalBlend,
    setMeetJozPortalBlend,
    world8Opacity,
    setWorld8Opacity,
    worldxInDelay,
    setWorldxInDelay,
    showModel4,
    setShowModel4,
    isWorkStepInteractive,
    setIsWorkStepInteractive,
    meetJozReadableBackdrop,
    setMeetJozReadableBackdrop,
    modeForAurx,
    setModeForAurx,
    triggerCount,
    setTriggerCount,
    aurxOutDelay,
    setAurxOutDelay,
    aurxPlaybackDelay,
    setAurxPlaybackDelay,
    forcedOpacity,
    setForcedOpacity,
    resetCounter,
    setResetCounter,
    toggleJkxRef,
    resumeFromSkills,
    pauseFromBack1,
    pendingJkxOpenRef,
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
    dispatchAppAction,
  };
}
