import {
  getMeetJozIdleActionLine,
  getMeetJozLocationLine,
  getMeetJozLogicalLayer,
  MEET_JOZ_ACTION_LABELS,
} from "../../world-model/meetJoz";

export function summarizeVoiceActionLine({
  action,
  awareness,
  error,
  processLine,
  statusLine,
  agentLine,
}) {
  const cleanAction = String(action || "").toLowerCase().trim();
  const cleanAwareness = String(awareness || "").trim();
  const cleanError = String(error || "").trim();
  const cleanProcess = String(processLine || "").trim();
  const cleanStatus = String(statusLine || "").trim();
  const cleanAgent = String(agentLine || "").trim();
  const isNuclearSkillsSequence = /going nuclear to skills/i.test(cleanAwareness);

  const formatValue = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    return text.replace(/^[a-z]/, (char) => char.toUpperCase());
  };

  if (cleanError) {
    if (/backend did not respond|failed|error/i.test(cleanError)) return "Action: Backend unavailable";
    return "Action: Needs retry";
  }

  const actionMap = {
    ...MEET_JOZ_ACTION_LABELS,
    vibe: cleanAwareness.toLowerCase().includes("return") ? "Action: Returning to Flex" : "Action: Opening Flex",
    discover: cleanAwareness.toLowerCase().includes("return") ? "Action: Returning to Ascend" : "Action: Opening Ascend",
    skills: isNuclearSkillsSequence ? "Action: Playing Flex to Skills" : "Action: Opening Mogg",
  };

  if (cleanAction && actionMap[cleanAction]) return actionMap[cleanAction];

  const combined = [cleanProcess, cleanStatus, cleanAgent, cleanAwareness].filter(Boolean).join(" ").toLowerCase();
  if (/clarify|specific aspect|what you're interested in|what specific/i.test(combined)) return "Action: Needs clarification";
  if (/understanding where you are|syncing world state/i.test(combined)) return "Action: Reading world state";
  if (/applying that here/i.test(combined)) return "Action: Applying decision";
  if (/portal beginning/i.test(cleanAwareness)) return "Action: At the portal beginning";

  if (cleanProcess) return `Action: ${formatValue(cleanProcess)}`;
  if (cleanStatus) return `Action: ${formatValue(cleanStatus)}`;
  if (cleanAgent) return `Action: ${formatValue(cleanAgent)}`;
  if (cleanAwareness) return "Action: Ready for next step";
  return "Action: Ready to reason";
}

export function buildVoiceSuggestionLines({
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
  voiceDebugEventRawInput,
  voiceDebugEventAction,
  voiceDebugEventAwareness,
  voiceDebugEventError,
  voiceProcessLine,
  voiceStatusLine,
  agentAwarenessLine,
  isMobile,
  ar,
}) {
  const currentStage = String(agentCurrentMeshStage || "").toLowerCase().trim();
  const currentPhase = String(agentCurrentPhase || "").toLowerCase().trim();

  const activeMeetJozLayer = getMeetJozLogicalLayer({
    mesh: pendingMeetJozVoiceAction || agentCurrentMesh,
    stage: currentStage,
    showModel2,
    showModel3,
    showModel4,
    world8Active,
    isMeetJozDiscoverActive,
    isWorkStepInteractive,
  });

  let locationLine = "";
  if (currentPortal === "root") {
    locationLine = "Portal entrance";
  } else if (currentPortal === "maxx" || currentPortal === "the-vibe-energy") {
    if (currentPhase === "brain_entry") locationLine = "You are entering the abstract brain scene.";
    else if (currentPhase === "signal_flow") locationLine = "You are in signal flow between the neurons.";
    else if (currentPhase === "new_pathways") locationLine = "You are in the new pathways phase.";
    else if (currentPhase === "memory_building") locationLine = "You are in the memory-building phase.";
    else if (currentPhase === "inside_the_brain") locationLine = "You are deeper inside the brain.";
    else locationLine = "You are inside the brain portal.";
  } else if (currentPortal === "meet-joz") {
    locationLine = getMeetJozLocationLine(activeMeetJozLayer);
  }

  let prompt = "";
  if (currentPortal === "root") {
    if (lastPortal === "meet-joz") prompt = `Signal: "Show Neurons"`;
    else if (lastPortal === "maxx") prompt = `Signal: "Meet Joz"`;
    else prompt = `Signal: "Show Skills", or "Show Neurons"`;
  } else if (currentPortal === "maxx" || currentPortal === "the-vibe-energy") {
    const canLaunchSpace = Boolean(isMobile && ar);
    prompt =
      currentPhase === "inside_the_brain"
        ? canLaunchSpace
          ? `Signal: "World MAXX", "Play Neurons", or "Exit the World"`
          : `Signal: "Play Neurons", or "Exit the World"`
        : canLaunchSpace
          ? `Signal: "World MAXX", "Pause Neurons", or "Exit the World"`
          : `Signal: "Pause Neurons", or "Exit the World"`;
  } else if (currentPortal === "meet-joz") {
    if (activeMeetJozLayer === "portal_beginning" && !pendingMeetJozVoiceAction) {
      prompt = `Signal: "Mogg", "Contact Joz", or "Show Neurons"`;
    } else if (activeMeetJozLayer === "skills") {
      prompt =
        isMobile && ar
          ? `Signal: "World MAXX", "Contact Joz", or "Go Back"`
          : `Signal: "Contact Joz", "Show Neurons", or "Go Back"`;
    } else if (activeMeetJozLayer === "discover") {
      prompt = `Signal: "Mogg", "Contact Joz", or "Go Back"`;
    } else {
      prompt = `Signal: "Ascend", "Contact Joz", or "Show Neurons"`;
    }
  }

  const raw = String(voiceDebugEventRawInput || effectiveTranscript || "").trim();
  const primary = raw
    ? `Heard: "${raw.replace(/^[a-z]/, (char) => char.toUpperCase())}"`
    : effectiveListening
      ? "Heard: Awaiting intent"
      : "Heard: Standby";

  const secondary = locationLine
    ? `Context: ${locationLine}`
    : effectiveListening
      ? "Context: syncing world state"
      : "Context: idle";

  const idleMeetJozActionLine =
    currentPortal === "meet-joz"
      ? getMeetJozIdleActionLine({
          layer: getMeetJozLogicalLayer({
            mesh: agentCurrentMesh,
            stage: agentCurrentMeshStage,
            showModel2,
            showModel3,
            showModel4,
            world8Active,
            isMeetJozDiscoverActive,
            isWorkStepInteractive,
          }),
          stage: agentCurrentMeshStage,
        })
      : "";

  const tertiary =
    !effectiveListening &&
    !voiceDebugEventAction &&
    !voiceDebugEventAwareness &&
    !voiceProcessLine &&
    !voiceStatusLine
      ? "Action: agent offline"
      : currentPortal === "meet-joz" &&
          !String(voiceDebugEventRawInput || "").trim() &&
          !voiceProcessLine &&
          !voiceStatusLine &&
          !agentAwarenessLine &&
          idleMeetJozActionLine
        ? idleMeetJozActionLine
        : summarizeVoiceActionLine({
            action: voiceDebugEventAction,
            awareness: voiceDebugEventAwareness,
            error: voiceDebugEventError,
            processLine: voiceProcessLine,
            statusLine: voiceStatusLine,
            agentLine: agentAwarenessLine,
          });

  return { prompt, primary, secondary, tertiary, locationLine, idleMeetJozActionLine };
}
