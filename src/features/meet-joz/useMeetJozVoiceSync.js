import { useCallback, useEffect } from "react";

import {
  getMeetJozAmbientActionStage,
  getMeetJozVoiceLayer,
  resolveMeetJozCommand,
} from "../../world-model/meetJoz";

export function useMeetJozVoiceSync({
  micEnabledRef,
  effectiveListening,
  voiceDebugEventRawInput,
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
}) {
  useEffect(() => {
    if (!micEnabledRef.current && !effectiveListening) return;
    if (String(voiceDebugEventRawInput || "").trim()) return;
    if (pendingMeetJozVoiceAction) return;

    let layerAction = "";
    if (currentPortal === "meet-joz") {
      layerAction = getMeetJozAmbientActionStage({
        mesh: agentCurrentMesh,
        stage: agentCurrentMeshStage,
        showModel2,
        showModel3,
        showModel4,
        world8Active,
        isMeetJozDiscoverActive,
        isWorkStepInteractive,
      });
    }

    setVoiceDebugEvent((current) => {
      if (current.action === layerAction && current.source === "state") {
        return current;
      }
      return {
        ...current,
        source: layerAction ? "state" : "",
        action: layerAction,
        awareness: "",
        target: "",
        error: "",
        updatedAt: Date.now(),
      };
    });
  }, [
    agentCurrentMesh,
    agentCurrentMeshStage,
    currentPortal,
    effectiveListening,
    isMeetJozDiscoverActive,
    isWorkStepInteractive,
    micEnabledRef,
    pendingMeetJozVoiceAction,
    setVoiceDebugEvent,
    showModel2,
    showModel3,
    showModel4,
    voiceDebugEventRawInput,
    world8Active,
  ]);

  const syncMeetJozClickAction = useCallback(
    (action, awareness = "", rawInput = "") => {
      if (!micEnabledRef.current && !effectiveListening) return;
      if (awareness) {
        window.__aiSay?.(awareness);
      }
      pushVoiceDebugEvent({
        status: "applied",
        rawInput,
        spoken: rawInput,
        source: "click",
        action,
        target: "",
        awareness,
        error: "",
      });
    },
    [effectiveListening, micEnabledRef, pushVoiceDebugEvent]
  );

  const getCurrentMeetJozLayer = useCallback(() => {
    return getMeetJozVoiceLayer(agentCurrentMesh, agentCurrentMeshStage) || "";
  }, [agentCurrentMesh, agentCurrentMeshStage]);

  const syncMeetJozSemanticCommand = useCallback(
    (commandKey, options = {}) => {
      const sourceLayer =
        options.sourceLayer != null
          ? String(options.sourceLayer || "").toLowerCase().trim()
          : getCurrentMeetJozLayer();
      const resolved = resolveMeetJozCommand(sourceLayer, commandKey);
      syncMeetJozClickAction(
        options.action || resolved?.action || "",
        options.awareness ?? resolved?.awareness ?? "",
        options.rawInput || ""
      );
      return resolved;
    },
    [getCurrentMeetJozLayer, syncMeetJozClickAction]
  );

  return {
    syncMeetJozClickAction,
    getCurrentMeetJozLayer,
    syncMeetJozSemanticCommand,
  };
}
