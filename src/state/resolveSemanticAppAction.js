import { getMeetJozVoiceLayer } from "../world-model/meetJoz";
import { APP_ACTIONS } from "./actionTypes";

export function resolveSemanticAppAction({
  action,
  currentPortal,
  currentMesh,
  currentMeshStage,
  meetJozSkillsReady = false,
} = {}) {
  const normalized = String(action || "").toLowerCase().trim();
  if (!normalized) return null;

  if (normalized === "brain" || normalized === "enter" || normalized === "maxx") {
    return {
      kind: "dispatch",
      type: APP_ACTIONS.NAVIGATE,
      payload: { targetPath: "/neo/maxx" },
    };
  }

  if (normalized === "ball" || normalized === "meet-joz" || normalized === "meet joz") {
    return {
      kind: "dispatch",
      type: APP_ACTIONS.OPEN_BALL_PORTAL,
      payload: {},
    };
  }

  if (normalized === "launch_in_space_n2x") {
    return { kind: "ar", target: "n2x" };
  }

  if (normalized === "launch_in_space_workf") {
    return { kind: "ar", target: "workf" };
  }

  if (normalized === "back1" || normalized === "vibe_back1") {
    return currentPortal === "meet-joz"
      ? { kind: "controlled-helper", helper: "voiceBack1ControlledGLB" }
      : { kind: "dispatch", type: APP_ACTIONS.MEET_JOZ_BACK1, payload: {} };
  }

  if (normalized === "back" || normalized === "vibe_back") {
    return currentPortal === "meet-joz"
      ? { kind: "controlled-helper", helper: "voiceBackControlledGLB" }
      : { kind: "dispatch", type: APP_ACTIONS.MEET_JOZ_BACK, payload: {} };
  }

  if (!["vibe", "discover", "skills"].includes(normalized)) {
    return null;
  }

  if (normalized === "skills" && currentPortal !== "meet-joz") {
    return {
      kind: "dispatch",
      type: APP_ACTIONS.NAVIGATE,
      payload: {
        targetPath: "/neo/meet-joz",
        deferredAction: "skills",
        runNuclearSkillsSequence: true,
      },
    };
  }

  if (currentPortal !== "meet-joz") {
    return {
      kind: "dispatch",
      type: APP_ACTIONS.NAVIGATE,
      payload: {
        targetPath: "/neo/meet-joz",
        deferredAction: normalized,
        runNuclearSkillsSequence: normalized === "skills",
      },
    };
  }

  const meetJozLayer = getMeetJozVoiceLayer(currentMesh, currentMeshStage);

  if (normalized === "vibe") {
    if (meetJozLayer === "skills") {
      return { kind: "controlled-helper", helper: "voiceSkillsToVibeControlledGLB" };
    }

    return { kind: "controlled-helper", helper: "voiceReturnVibeControlledGLB" };
  }

  if (normalized === "discover") {
    if (meetJozLayer === "skills") {
      return { kind: "controlled-helper", helper: "voiceBack1ControlledGLB" };
    }

    if (meetJozLayer === "vibe") {
      return { kind: "controlled-trigger", value: "vibe" };
    }

    return { kind: "controlled-trigger", value: "discover" };
  }

  if (meetJozLayer === "skills" && meetJozSkillsReady) {
    return { kind: "force-state", target: "skills" };
  }

  return { kind: "controlled-trigger", value: "skills" };
}
