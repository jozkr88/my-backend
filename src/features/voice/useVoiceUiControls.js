import { useCallback, useEffect, useRef, useState } from "react";

export function useVoiceUiControls({
  currentPortal,
  effectiveListening,
  isMicrophoneAvailable,
  isMobile,
  micEnabled,
  setMicEnabled,
  startMicListening,
  stopMicListening,
  helpFadeDurationMs = 320,
}) {
  const [voiceHintsEnabled, setVoiceHintsEnabled] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isHelpRendered, setIsHelpRendered] = useState(false);
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [isHelpPanelHovered, setIsHelpPanelHovered] = useState(false);
  const [helpSlideIndex, setHelpSlideIndex] = useState(0);
  const helpSlideTouchStartXRef = useRef(null);

  useEffect(() => {
    if (!isHelpOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsHelpOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHelpOpen]);

  useEffect(() => {
    if (isHelpOpen) {
      setIsHelpRendered(true);
      return undefined;
    }

    setIsHelpVisible(false);
    if (!isHelpRendered) return undefined;

    const timeoutId = window.setTimeout(() => {
      setIsHelpRendered(false);
    }, helpFadeDurationMs);

    return () => window.clearTimeout(timeoutId);
  }, [helpFadeDurationMs, isHelpOpen, isHelpRendered]);

  useEffect(() => {
    if (!isHelpRendered) return undefined;

    const rafId = window.requestAnimationFrame(() => {
      setIsHelpVisible(isHelpOpen);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [isHelpOpen, isHelpRendered]);

  useEffect(() => {
    if (isHelpRendered) return;
    setHelpSlideIndex(0);
    helpSlideTouchStartXRef.current = null;
    setIsHelpPanelHovered(false);
  }, [isHelpRendered]);

  useEffect(() => {
    setIsHelpOpen(false);
  }, [currentPortal]);

  useEffect(() => {
    setVoiceHintsEnabled(Boolean(micEnabled || effectiveListening));
  }, [effectiveListening, micEnabled]);

  useEffect(() => {
    if (
      !isMobile &&
      micEnabled &&
      !effectiveListening &&
      isMicrophoneAvailable !== false
    ) {
      console.log("🔁 Mic stopped — restarting automatically");
      startMicListening();
    }
  }, [
    effectiveListening,
    isMicrophoneAvailable,
    isMobile,
    micEnabled,
    startMicListening,
  ]);

  const handleEnableMic = useCallback(async () => {
    console.log("🎙️ Enabling mic after user tap...");
    const started = await startMicListening();
    setMicEnabled(started);
  }, [setMicEnabled, startMicListening]);

  const handleAgentButtonClick = useCallback(async () => {
    if (!micEnabled) {
      const started = await startMicListening();
      setMicEnabled(started);
      setVoiceHintsEnabled(started);
      return;
    }

    if (effectiveListening) {
      setMicEnabled(false);
      await stopMicListening();
      setVoiceHintsEnabled(false);
      return;
    }

    const started = await startMicListening();
    setMicEnabled(started);
    setVoiceHintsEnabled(started);
  }, [
    effectiveListening,
    micEnabled,
    setMicEnabled,
    startMicListening,
    stopMicListening,
  ]);

  const toggleHelp = useCallback(() => {
    setIsHelpOpen((current) => !current);
  }, []);

  const closeHelp = useCallback(() => {
    setIsHelpOpen(false);
  }, []);

  const handleHelpOverlayClick = useCallback(() => {
    if (!isHelpOpen) return;
    setIsHelpOpen(false);
  }, [isHelpOpen]);

  const handleHelpPanelPointerEnter = useCallback(() => {
    if (!isHelpOpen) return;
    setIsHelpPanelHovered(true);
  }, [isHelpOpen]);

  const handleHelpPanelPointerLeave = useCallback(() => {
    setIsHelpPanelHovered(false);
  }, []);

  const handleHelpSlideTouchStart = useCallback((event) => {
    helpSlideTouchStartXRef.current = event.touches[0]?.clientX ?? null;
  }, []);

  const handleHelpSlideTouchEnd = useCallback((event) => {
    const startX = helpSlideTouchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX ?? null;
    helpSlideTouchStartXRef.current = null;

    if (startX == null || endX == null) return;

    const deltaX = endX - startX;
    const swipeThreshold = 40;

    if (Math.abs(deltaX) < swipeThreshold) return;

    if (deltaX < 0) {
      setHelpSlideIndex((current) => Math.min(current + 1, 2));
      return;
    }

    setHelpSlideIndex((current) => Math.max(current - 1, 0));
  }, []);

  return {
    voiceHintsEnabled,
    setVoiceHintsEnabled,
    isHelpOpen,
    isHelpRendered,
    isHelpVisible,
    isHelpPanelHovered,
    helpSlideIndex,
    setHelpSlideIndex,
    handleEnableMic,
    handleAgentButtonClick,
    toggleHelp,
    closeHelp,
    handleHelpOverlayClick,
    handleHelpPanelPointerEnter,
    handleHelpPanelPointerLeave,
    handleHelpSlideTouchStart,
    handleHelpSlideTouchEnd,
  };
}
