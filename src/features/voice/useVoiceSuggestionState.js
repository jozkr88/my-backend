import { useEffect, useMemo, useState } from "react";

import { buildVoiceSuggestionLines } from "./selectors";

export function useVoiceSuggestionState({
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
}) {
  const [stablePrompt, setStablePrompt] = useState("");
  const voiceSuggestionState = useMemo(
    () =>
      buildVoiceSuggestionLines({
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
        voiceDebugEventRawInput: voiceDebugEvent.rawInput,
        voiceDebugEventAction: voiceDebugEvent.action,
        voiceDebugEventAwareness: voiceDebugEvent.awareness,
        voiceDebugEventError: voiceDebugEvent.error,
        voiceProcessLine,
        voiceStatusLine,
        agentAwarenessLine,
        isMobile,
        ar,
      }),
    [
      agentAwarenessLine,
      agentCurrentMesh,
      agentCurrentMeshStage,
      agentCurrentPhase,
      ar,
      currentPortal,
      effectiveListening,
      effectiveTranscript,
      isMeetJozDiscoverActive,
      isMobile,
      isWorkStepInteractive,
      lastPortal,
      pendingMeetJozVoiceAction,
      showModel2,
      showModel3,
      showModel4,
      voiceDebugEvent.action,
      voiceDebugEvent.awareness,
      voiceDebugEvent.error,
      voiceDebugEvent.rawInput,
      voiceProcessLine,
      voiceStatusLine,
      world8Active,
    ]
  );

  useEffect(() => {
    const nextPrompt = String(voiceSuggestionState.prompt || "").trim();
    if (!nextPrompt) return;
    if (nextPrompt === stablePrompt) return;

    const handle = window.setTimeout(() => {
      setStablePrompt(nextPrompt);
    }, 120);

    return () => window.clearTimeout(handle);
  }, [stablePrompt, voiceSuggestionState.prompt]);

  useEffect(() => {
    if (stablePrompt) return;
    const nextPrompt = String(voiceSuggestionState.prompt || "").trim();
    if (!nextPrompt) return;
    setStablePrompt(nextPrompt);
  }, [stablePrompt, voiceSuggestionState.prompt]);

  useEffect(() => {
    if (currentPortal === "meet-joz") return;
    if (!meetJozReadableBackdrop) return;
    setMeetJozReadableBackdrop(false);
  }, [
    currentPortal,
    meetJozReadableBackdrop,
    setMeetJozReadableBackdrop,
  ]);

  return {
    voiceSuggestionPrimaryLine: voiceSuggestionState.primary,
    voiceSuggestionSecondaryLine: voiceSuggestionState.secondary,
    voiceSuggestionTertiaryLine: voiceSuggestionState.tertiary,
    voiceSuggestionQuaternaryLine: stablePrompt || voiceSuggestionState.prompt,
    useDarkVoiceSuggestions:
      currentPortal === "meet-joz" && meetJozReadableBackdrop,
  };
}
