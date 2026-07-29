import { useCallback, useEffect } from "react";

export function useMeetJozController({
  currentPortal,
  runtime,
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
}) {
  const {
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
  } = runtime;

  const applyMeetJozFlexRestState = useCallback((awareness = "") => {
    pendingJkxOpenRef.current = false;
    setCurrentMeshContext("vibe", { stage: "flex_stop" });
    setAgentCurrentMesh("vibe");
    setShowMeetJozMetaballs(false);
    setIsMeetJozDiscoverActive(false);
    setMeetJozPortalBlend(0);
    setShowMeetJozEnvBackground(false);
    setWorldxInDelay(0);
    setIsWorkStepInteractive(false);
    setShowModel4(false);
    setShowModel3(false);
    setWorld8Opacity(null);
    setForcedOpacity(null);
    setShowModel2(false);
    setWorld8Active(false);
    setModeForAurx("fadeOnly");
    setAurxOutDelay(0);
    setAurxPlaybackDelay(0);
    setTriggerCount((c) => c + 1);
    if (awareness) {
      syncMeetJozClickAction("vibe", awareness);
    }
  }, [
    pendingJkxOpenRef,
    setCurrentMeshContext,
    setAgentCurrentMesh,
    setShowMeetJozMetaballs,
    setIsMeetJozDiscoverActive,
    setMeetJozPortalBlend,
    setShowMeetJozEnvBackground,
    setWorldxInDelay,
    setIsWorkStepInteractive,
    setShowModel4,
    setShowModel3,
    setWorld8Opacity,
    setForcedOpacity,
    setShowModel2,
    setWorld8Active,
    setModeForAurx,
    setTriggerCount,
    syncMeetJozClickAction,
  ]);

  const hideMeetJozWorkStepVisuals = useCallback(() => {
    pendingJkxOpenRef.current = false;
    hideContactCta();
    setIsWorkStepInteractive(false);
    setShowModel4(false);
    pauseFromBack1.current?.();
  }, [hideContactCta, pendingJkxOpenRef, pauseFromBack1, setIsWorkStepInteractive, setShowModel4]);

  const hideMeetJozWorld8Visuals = useCallback(() => {
    setShowMeetJozEnvBackground(false);
    setWorld8Opacity(null);
    setWorld8Active(false);
  }, [setShowMeetJozEnvBackground, setWorld8Opacity, setWorld8Active]);

  const hideMeetJozWorldxVisuals = useCallback(() => {
    setShowModel2(false);
  }, [setShowModel2]);

  const showMeetJozWorldxVisuals = useCallback(() => {
    setWorldxInDelay(0);
    setShowModel2(true);
  }, [setShowModel2, setWorldxInDelay]);

  const handleVibeClick = useCallback(() => {
    pendingJkxOpenRef.current = false;
    setCurrentMeshContext("vibe");
    setAgentCurrentMesh("vibe");
    setShowMeetJozMetaballs(false);
    setIsMeetJozDiscoverActive(false);
    setMeetJozPortalBlend(0);
    setShowMeetJozEnvBackground(false);
    setWorldxInDelay(0.9);
    setIsWorkStepInteractive(false);
    setShowModel4(false);
    setShowModel3(false);
    setWorld8Opacity(null);
    setForcedOpacity(null);
    setShowModel2(true);
    setWorld8Active(true);
    setModeForAurx("fadeOnly");
    setAurxOutDelay(0);
    setAurxPlaybackDelay(0);
    setTriggerCount((c) => c + 1);
    syncMeetJozSemanticCommand("flex", { action: "vibe" });
  }, [
    pendingJkxOpenRef,
    setCurrentMeshContext,
    setAgentCurrentMesh,
    setShowMeetJozMetaballs,
    setIsMeetJozDiscoverActive,
    setMeetJozPortalBlend,
    setShowMeetJozEnvBackground,
    setWorldxInDelay,
    setIsWorkStepInteractive,
    setShowModel4,
    setShowModel3,
    setWorld8Opacity,
    setForcedOpacity,
    setShowModel2,
    setWorld8Active,
    setModeForAurx,
    setTriggerCount,
    syncMeetJozSemanticCommand,
  ]);

  const handleBackClick = useCallback(() => {
    const sourceLayer = getCurrentMeetJozLayer();
    pendingJkxOpenRef.current = false;
    setCurrentMeshContext(null, { stage: "vibe_back" });
    setAgentCurrentMesh(null);
    setShowMeetJozEnvBackground(false);
    setWorldxInDelay(0.9);
    setForcedOpacity(null);
    setWorld8Opacity(null);
    setShowModel2(false);
    setShowModel3(false);
    setShowModel4(false);
    setIsWorkStepInteractive(false);
    setWorld8Active(false);
    setModeForAurx("playBackward");
    setAurxPlaybackDelay(0.34);
    setTriggerCount((c) => c + 1);
    setAurxOutDelay(0.5);
    pauseFromBack1.current?.();
    syncMeetJozSemanticCommand("back", {
      sourceLayer,
      awareness: "At the portal beginning.",
    });
  }, [
    getCurrentMeetJozLayer,
    pendingJkxOpenRef,
    setCurrentMeshContext,
    setAgentCurrentMesh,
    setShowMeetJozEnvBackground,
    setWorldxInDelay,
    setForcedOpacity,
    setWorld8Opacity,
    setShowModel2,
    setShowModel3,
    setShowModel4,
    setIsWorkStepInteractive,
    setWorld8Active,
    setModeForAurx,
    setTriggerCount,
    setAurxOutDelay,
    pauseFromBack1,
    syncMeetJozSemanticCommand,
  ]);

  const handleDiscoverClick = useCallback(() => {
    pendingJkxOpenRef.current = false;
    setCurrentMeshContext("discover");
    setAgentCurrentMesh("discover");
    setShowMeetJozMetaballs(true);
    setMeetJozMetaballsProgress(0.15);
    setIsMeetJozDiscoverActive(true);
    setMeetJozPortalBlend(1);
    setShowMeetJozEnvBackground(true);
    setIsWorkStepInteractive(false);
    setShowModel4(false);
    setShowModel2(true);
    setShowModel3(true);
    setWorld8Active(true);
    setWorld8Opacity(null);
    setForcedOpacity(null);
    setModeForAurx("playForward");
    setAurxOutDelay(0);
    setAurxPlaybackDelay(0);
    setTriggerCount((c) => c + 1);
    syncMeetJozSemanticCommand("discover");
  }, [
    pendingJkxOpenRef,
    setCurrentMeshContext,
    setAgentCurrentMesh,
    setShowMeetJozMetaballs,
    setMeetJozMetaballsProgress,
    setIsMeetJozDiscoverActive,
    setMeetJozPortalBlend,
    setShowMeetJozEnvBackground,
    setIsWorkStepInteractive,
    setShowModel4,
    setShowModel2,
    setShowModel3,
    setWorld8Active,
    setWorld8Opacity,
    setForcedOpacity,
    setModeForAurx,
    setTriggerCount,
    syncMeetJozSemanticCommand,
  ]);

  const openWorkStep = useCallback(({ queueJkx = false, restart = false } = {}) => {
    pendingJkxOpenRef.current = queueJkx;
    setCurrentMeshContext("skills");
    setAgentCurrentMesh("skills");
    if (restart) {
      setResetCounter((c) => c + 1);
    }
    setIsMeetJozDiscoverActive(false);
    setMeetJozPortalBlend(0);
    setShowMeetJozMetaballs(false);
    setShowModel3(false);
    setWorldxInDelay(0.9);
    setModeForAurx("fadeOnly");
    setAurxOutDelay(0);
    setAurxPlaybackDelay(0);
    setIsWorkStepInteractive(false);
    setShowModel4(true);
    setWorld8Opacity(0.7);
    setForcedOpacity(0.2);
    setShowModel2(false);
    resumeFromSkills.current?.();
  }, [
    pendingJkxOpenRef,
    setCurrentMeshContext,
    setAgentCurrentMesh,
    setResetCounter,
    setIsMeetJozDiscoverActive,
    setMeetJozPortalBlend,
    setShowMeetJozMetaballs,
    setShowModel3,
    setWorldxInDelay,
    setModeForAurx,
    setIsWorkStepInteractive,
    setShowModel4,
    setWorld8Opacity,
    setForcedOpacity,
    setShowModel2,
    resumeFromSkills,
  ]);

  const handleDigitalTwinToggle = useCallback((mode = "workf") => {
    const wantsJkx = mode === "jkx";

    if (!wantsJkx) {
      openWorkStep({ queueJkx: false, restart: showModel4 });
      return;
    }

    if (!showModel4 || !isWorkStepInteractive) {
      openWorkStep({ queueJkx: true });
      return;
    }

    toggleJkxRef.current?.();
  }, [isWorkStepInteractive, openWorkStep, showModel4, toggleJkxRef]);

  const handleSkillsClick = useCallback(() => {
    console.log("[App] handleSkillsClick → tell FadableModel4 to resume");
    openWorkStep({ queueJkx: false });
    syncMeetJozSemanticCommand("skills");
  }, [openWorkStep, syncMeetJozSemanticCommand]);

  const handleBack1Click = useCallback(() => {
    pendingJkxOpenRef.current = false;
    setCurrentMeshContext("discover", { stage: "vibe_back1" });
    setAgentCurrentMesh("discover");
    hideMeetJozWorkStepVisuals();
    setShowMeetJozEnvBackground(true);
    setWorldxInDelay(0);
    setShowModel3(false);
    setModeForAurx("fadeOnly");
    setAurxOutDelay(0);
    setAurxPlaybackDelay(0);
    setWorld8Active(true);
    setWorld8Opacity(1);
    setForcedOpacity(1);
    setShowModel2(true);
    setResetCounter((c) => c + 1);

    syncMeetJozSemanticCommand("back", {
      sourceLayer: "skills",
      action: "vibe_back1",
      awareness: "Stepping back.",
    });
  }, [
    pendingJkxOpenRef,
    setCurrentMeshContext,
    setAgentCurrentMesh,
    hideMeetJozWorkStepVisuals,
    setShowMeetJozEnvBackground,
    setWorldxInDelay,
    setShowModel3,
    setModeForAurx,
    setAurxOutDelay,
    setAurxPlaybackDelay,
    setTriggerCount,
    setWorld8Active,
    setWorld8Opacity,
    setForcedOpacity,
    setShowModel2,
    setResetCounter,
    syncMeetJozSemanticCommand,
  ]);

  useEffect(() => {
    if (!showModel4 || !isWorkStepInteractive || !pendingJkxOpenRef.current) return;
    pendingJkxOpenRef.current = false;
    toggleJkxRef.current?.();
  }, [showModel4, isWorkStepInteractive, pendingJkxOpenRef, toggleJkxRef]);

  useEffect(() => {
    forceMeetJozVibeStateRef.current = handleVibeClick;
  }, [forceMeetJozVibeStateRef, handleVibeClick]);

  useEffect(() => {
    forceMeetJozDiscoverStateRef.current = handleDiscoverClick;
  }, [forceMeetJozDiscoverStateRef, handleDiscoverClick]);

  useEffect(() => {
    forceMeetJozSkillsStateRef.current = handleSkillsClick;
  }, [forceMeetJozSkillsStateRef, handleSkillsClick]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__meetJozSkillsReady = Boolean(showModel4 || isWorkStepInteractive);

    return () => {
      delete window.__meetJozSkillsReady;
    };
  }, [handleSkillsClick, isWorkStepInteractive, showModel4]);

  useEffect(() => {
    forceMeetJozBack1StateRef.current = handleBack1Click;
  }, [forceMeetJozBack1StateRef, handleBack1Click]);

  useEffect(() => {
    if (currentPortal !== "meet-joz") {
      pendingJkxOpenRef.current = false;
      setShowModel2(false);
      setShowModel3(false);
      setShowModel4(false);
      setWorld8Active(false);
      setIsWorkStepInteractive(false);
      setWorld8Opacity(null);
      setForcedOpacity(null);
      setWorldxInDelay(0.9);
      setModeForAurx("fadeOnly");
      setIsMeetJozDiscoverActive(false);
      setShowMeetJozEnvBackground(false);
      setMeetJozPortalBlend(0);
      setShowMeetJozMetaballs(false);
      setMeetJozMetaballsProgress(0);
    }
  }, [
    currentPortal,
    pendingJkxOpenRef,
    setShowModel2,
    setShowModel3,
    setShowModel4,
    setWorld8Active,
    setIsWorkStepInteractive,
    setWorld8Opacity,
    setForcedOpacity,
    setWorldxInDelay,
    setModeForAurx,
    setIsMeetJozDiscoverActive,
    setShowMeetJozEnvBackground,
    setMeetJozPortalBlend,
    setShowMeetJozMetaballs,
    setMeetJozMetaballsProgress,
  ]);

  return {
    applyMeetJozFlexRestState,
    hideMeetJozWorkStepVisuals,
    hideMeetJozWorld8Visuals,
    hideMeetJozWorldxVisuals,
    showMeetJozWorldxVisuals,
    handleVibeClick,
    handleBackClick,
    handleDiscoverClick,
    openWorkStep,
    handleDigitalTwinToggle,
    handleSkillsClick,
    handleBack1Click,
  };
}
