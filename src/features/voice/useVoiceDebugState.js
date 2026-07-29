import { useCallback, useEffect, useState } from "react";

const INITIAL_VOICE_DEBUG_EVENT = {
  status: "idle",
  spoken: "",
  rawInput: "",
  source: "",
  action: "",
  target: "",
  awareness: "",
  error: "",
  updatedAt: 0,
};

export function useVoiceDebugState({
  currentPortal,
  effectiveListening,
  setVoiceProcessLine,
  setVoiceStatusLine,
}) {
  const [voiceDebugEvent, setVoiceDebugEvent] = useState(INITIAL_VOICE_DEBUG_EVENT);

  const pushVoiceDebugEvent = useCallback((patch) => {
    setVoiceDebugEvent((current) => ({
      ...current,
      ...patch,
      updatedAt: Date.now(),
    }));
  }, []);

  const appendVoiceSessionEntry = useCallback(() => {}, []);
  const finalizeVoiceSessionEntry = useCallback(() => {}, []);

  useEffect(() => {
    setVoiceDebugEvent((current) => ({
      ...current,
      spoken: "",
      rawInput: "",
      source: "",
      action: "",
      target: "",
      awareness: "",
      error: "",
      status: effectiveListening ? "listening" : "idle",
      updatedAt: Date.now(),
    }));
    setVoiceProcessLine("");
    setVoiceStatusLine("");
  }, [currentPortal, effectiveListening, setVoiceProcessLine, setVoiceStatusLine]);

  return {
    voiceDebugEvent,
    setVoiceDebugEvent,
    pushVoiceDebugEvent,
    appendVoiceSessionEntry,
    finalizeVoiceSessionEntry,
  };
}
