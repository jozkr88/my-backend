import { getAllowedActionsForPortalState } from "../shared/appWorld";
import { resolveMeetJozSemanticCommand } from "../shared/meetJozSemantics";

export const MEET_JOZ_VIBE_STOP_F = 70;
export const MEET_JOZ_ASCEND_EXIT_END_F = 106;
export const MEET_JOZ_DISC_STOP_F = 250;
export const MEET_JOZ_TWIN_WORKF_START_F = 180;
export const MEET_JOZ_TWIN_WORKF_END_F = 320;
export const MEET_JOZ_SKILLS_REVEAL_START_F = 274;
export const MEET_JOZ_SKILLS_REVEAL_END_F = 307;
export const MEET_JOZ_SKILLS_RESUME_TO_F = 320;

export function getMeetJozFrameState(frame) {
  const value = Number.isFinite(frame) ? frame : 0;

  if (value <= 1) {
    return { mesh: "vibe", stage: "flex_stop" };
  }

  if (value < MEET_JOZ_VIBE_STOP_F) {
    return { mesh: value <= 40 ? "vibe" : "discover", stage: "ascend_opening" };
  }

  if (value <= 70) {
    return { mesh: "discover", stage: "ascend_stop" };
  }

  if (value < MEET_JOZ_ASCEND_EXIT_END_F) {
    return { mesh: "discover", stage: "skills_opening" };
  }

  if (value < MEET_JOZ_DISC_STOP_F) {
    return { mesh: "skills", stage: "skills_opening" };
  }

  if (value <= MEET_JOZ_DISC_STOP_F) {
    return { mesh: "skills", stage: "skills_stop" };
  }

  if (value < MEET_JOZ_SKILLS_RESUME_TO_F) {
    return { mesh: "skills", stage: "skills_opening" };
  }

  return { mesh: "skills", stage: "skills_stop" };
}

export function getMeetJozRewindStage(targetFrame) {
  if (!Number.isFinite(targetFrame)) return null;
  if (targetFrame <= 1) return "vibe_back";
  if (Math.abs(targetFrame - MEET_JOZ_VIBE_STOP_F) <= 1) return "vibe_back1";
  return null;
}

export function getMeetJozVoiceLayer(currentMesh, currentStage) {
  const stage = String(currentStage || "").toLowerCase().trim();
  const mesh = String(currentMesh || "").toLowerCase().trim();

  if (stage === "skills_opening" || stage === "skills_stop" || stage === "vibe_back1") {
    return "skills";
  }

  if (stage === "ascend_opening" || stage === "ascend_stop" || stage === "vibe_back") {
    return "discover";
  }

  if (stage === "flex_opening" || stage === "flex_stop") {
    return "vibe";
  }

  return mesh || null;
}

export function getAllowedActionsForPortal(currentPortal, currentMesh, currentStage = null) {
  const meetJozLayer =
    currentPortal === "meet-joz"
      ? getMeetJozVoiceLayer(currentMesh, currentStage)
      : null;

  return getAllowedActionsForPortalState(currentPortal, {
    meetJozLayer,
    includeUtilityActions: true,
  });
}

export function resolveMeetJozCommand(mesh, commandKey) {
  return resolveMeetJozSemanticCommand(mesh, commandKey);
}

export function getMeetJozLogicalLayer({
  mesh,
  stage,
  showModel2 = false,
  showModel3 = false,
  showModel4 = false,
  world8Active = false,
  isMeetJozDiscoverActive = false,
  isWorkStepInteractive = false,
} = {}) {
  const currentMesh = String(mesh || "").toLowerCase().trim();
  const currentStage = String(stage || "").toLowerCase().trim();

  if (currentStage === "skills_opening" || currentStage === "skills_stop") return "skills";
  if (currentStage === "ascend_opening" || currentStage === "ascend_stop") return "discover";
  if (currentStage === "flex_opening" || currentStage === "flex_stop") return "vibe";

  if (showModel4 || isWorkStepInteractive || currentMesh === "skills") return "skills";
  if (showModel3 || isMeetJozDiscoverActive || currentMesh === "discover") return "discover";
  if (showModel2 || world8Active || currentMesh === "vibe") return "vibe";

  return "portal_beginning";
}

export function getMeetJozAmbientActionStage({
  mesh,
  stage,
  showModel2 = false,
  showModel3 = false,
  showModel4 = false,
  world8Active = false,
  isMeetJozDiscoverActive = false,
  isWorkStepInteractive = false,
} = {}) {
  const currentMesh = String(mesh || "").toLowerCase().trim();
  const currentStage = String(stage || "").toLowerCase().trim();

  if (showModel4 || isWorkStepInteractive || currentMesh === "skills") {
    if (
      currentStage === "skills_stop" ||
      currentStage === "skills_opening" ||
      currentStage === "vibe_back1"
    ) return currentStage;
    return "skills_stop";
  }

  if (showModel3 || isMeetJozDiscoverActive) {
    if (
      currentStage === "ascend_stop" ||
      currentStage === "ascend_opening" ||
      currentStage === "skills_opening" ||
      currentStage === "vibe_back" ||
      currentStage === "vibe_back1"
    ) return currentStage;
    return "ascend_stop";
  }

  if (showModel2 || world8Active) {
    if (
      currentStage === "flex_stop" ||
      currentStage === "flex_opening" ||
      currentStage === "ascend_opening" ||
      currentStage === "vibe_back"
    ) return currentStage;
    return "flex_stop";
  }

  if (
    currentStage === "vibe_back" ||
    currentStage === "vibe_back1" ||
    currentStage === "skills_opening" ||
    currentStage === "ascend_stop" ||
    currentStage === "ascend_opening"
  ) return currentStage;

  if (currentStage === "flex_stop" || currentStage === "flex_opening") return currentStage;
  if (currentMesh === "discover") return "ascend_stop";
  if (currentMesh === "vibe") return "flex_stop";

  return "";
}

export function getMeetJozLocationLine(layer) {
  if (layer === "skills") return "You are at the Mogg layer";
  if (layer === "discover") return "You are at the Ascend layer";
  if (layer === "vibe") return "You are at the Flex layer";
  return "You are at the portal beginning";
}

export function getMeetJozIdleActionLine({ layer, stage }) {
  const currentStage = String(stage || "").toLowerCase().trim();

  if (layer === "skills") {
    if (currentStage === "vibe_back1") return "Action: Stepping back";
    if (currentStage === "skills_opening") return "Action: Opening Mogg";
    return "Action: At Mogg";
  }

  if (layer === "discover") {
    if (currentStage === "vibe_back") return "Action: Going back";
    if (currentStage === "vibe_back1") return "Action: Stepping back";
    if (currentStage === "skills_opening") return "Action: Opening Mogg";
    if (currentStage === "ascend_opening") return "Action: Opening Ascend";
    return "Action: At Ascend";
  }

  if (layer === "vibe") {
    if (currentStage === "vibe_back") return "Action: Going back";
    if (currentStage === "ascend_opening") return "Action: Opening Ascend";
    if (currentStage === "flex_opening") return "Action: Opening Flex";
    return "Action: At Flex";
  }

  if (currentStage === "vibe_back") return "Action: Going back";
  if (currentStage === "vibe_back1") return "Action: Stepping back";

  return "Action: At the portal beginning";
}

export const MEET_JOZ_ACTION_LABELS = {
  brain: "Action: Entering Brain",
  ball: "Action: Entering Meet Joz",
  flex_opening: "Action: Opening Flex",
  flex_stop: "Action: At Flex",
  ascend_opening: "Action: Opening Ascend",
  ascend_stop: "Action: At Ascend",
  skills_opening: "Action: Opening Mogg",
  skills_stop: "Action: At Mogg",
  vibe_back: "Action: Going back",
  vibe_back1: "Action: Stepping back",
  back: "Action: Exiting portal",
  pause: "Action: Pausing scene",
  resume: "Action: Resuming scene",
  n2x_pause: "Action: Pausing neurons",
  n2x_resume: "Action: Resuming neurons",
  contact_joz: "Action: Opening email",
  call_joz: "Action: Opening call",
  hide_contact_buttons: "Action: Hiding contact",
  show_contact_buttons: "Action: Showing contact",
  launch_in_space_n2x: "Action: Launching AR",
  launch_in_space_workf: "Action: Launching AR",
};
