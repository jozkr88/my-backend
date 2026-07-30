import { getMeetJozVoiceLayer, resolveMeetJozCommand } from "../world-model/meetJoz";
import {
  AR_PHRASES,
  BACK_PHRASES,
  CALL_PHRASES,
  CONTACT_PHRASES,
  DISCOVER_PHRASES,
  EXIT_PHRASES,
  FLEX_PHRASES,
  HIDE_CONTACT_PHRASES,
  PAUSE_PHRASES,
  RESUME_PHRASES,
  ROOT_BRAIN_PHRASES,
  ROOT_MEET_JOZ_PHRASES,
  SHOW_CONTACT_PHRASES,
  SKILLS_PHRASES,
  SURPRISE_ME_PHRASES,
  hasPhrase as hasAnyPhrase,
  normalizeVoiceTranscript,
} from "../shared/voiceCanonical";
import { resolvePlacementIntent } from "../world-model/placement";

export function detectImmediateMobileCommand(text) {
  const lower = normalizeVoiceTranscript(text);

  if (!lower) return null;
  // Preserve spatial requests such as “view skills around me” for the
  // placement/AR resolver instead of collapsing them into the Mogg shortcut.
  if (resolvePlacementIntent(lower)) return null;
  if (hasAnyPhrase(lower, SURPRISE_ME_PHRASES)) return "surprise me";
  if (hasAnyPhrase(lower, ROOT_MEET_JOZ_PHRASES)) return "meet joz";
  if (hasAnyPhrase(lower, [...ROOT_BRAIN_PHRASES, "open max"])) return "enter";
  if (hasAnyPhrase(lower, FLEX_PHRASES)) return "flex";
  if (hasAnyPhrase(lower, DISCOVER_PHRASES)) return "ascend";
  if (hasAnyPhrase(lower, SKILLS_PHRASES)) return "mogg";
  if (hasAnyPhrase(lower, AR_PHRASES)) return "open in space";
  if (hasAnyPhrase(lower, [...BACK_PHRASES, "leave"])) return "back";
  if (hasAnyPhrase(lower, ["pause", "stop"])) return "pause";
  if (hasAnyPhrase(lower, ["play", "resume", "continue"])) return "resume";

  return null;
}

export function resolveLocalVoiceCommand(spoken, currentPortal, currentMesh, currentStage = null) {
  const lower = normalizeVoiceTranscript(spoken);
  const mesh =
    currentPortal === "meet-joz"
      ? getMeetJozVoiceLayer(currentMesh, currentStage) || ""
      : String(currentMesh || "").toLowerCase().trim();

  if (!lower) return null;

  const placement = resolvePlacementIntent(lower, { currentPortal });
  if (placement) {
    return {
      action: placement.action,
      target: null,
      awareness: placement.action === "experience_spatially"
        ? "I’ll open a governed spatial experience preview for that Joz entity."
        : placement.targetMode === "ar"
        ? `I found ${placement.entityLabel}. I’ll prepare an AR placement preview for your confirmation.`
        : `I found ${placement.entityLabel}. I’ll prepare a deterministic world placement preview for your confirmation.`,
      placement,
    };
  }

  if (hasAnyPhrase(lower, HIDE_CONTACT_PHRASES)) {
    return {
      action: "hide_contact_buttons",
      target: null,
      awareness: "Contact button hidden. Say 'show contact' to bring it back.",
    };
  }

  if (hasAnyPhrase(lower, SHOW_CONTACT_PHRASES)) {
    return {
      action: "show_contact_buttons",
      target: null,
      awareness: "Contact button visible again.",
    };
  }

  if (hasAnyPhrase(lower, CONTACT_PHRASES)) {
    return {
      action: "contact_joz",
      target: "mailto:joz@meetjoz.com",
      awareness: "Opening your email app to contact Joz at joz@meetjoz.com.",
    };
  }

  if (hasAnyPhrase(lower, CALL_PHRASES)) {
    return {
      action: "call_joz",
      target: "tel:+41764973894",
      awareness: "Tap here to call Joz",
    };
  }

  if (currentPortal === "root") {
    if (hasAnyPhrase(lower, ROOT_BRAIN_PHRASES)) {
      return { action: "brain", target: "/neo/maxx", awareness: "Entering the Brain…" };
    }

    if (hasAnyPhrase(lower, ROOT_MEET_JOZ_PHRASES)) {
      return { action: "ball", target: "/neo/meet-joz", awareness: "Entering Meet Joz…" };
    }
  }

  if (currentPortal !== "maxx" && currentPortal !== "the-vibe-energy" && hasAnyPhrase(lower, ROOT_BRAIN_PHRASES)) {
    return { action: "brain", target: "/neo/maxx", awareness: "Cross-jumping to the Brain…" };
  }

  if (currentPortal !== "meet-joz" && hasAnyPhrase(lower, ROOT_MEET_JOZ_PHRASES)) {
    return { action: "ball", target: "/neo/meet-joz", awareness: "Cross-jumping to Meet Joz…" };
  }

  if (hasAnyPhrase(lower, SURPRISE_ME_PHRASES)) {
    return { action: "skills", target: "/neo/meet-joz", awareness: "Going nuclear to Skills." };
  }

  if (currentPortal === "root" && hasAnyPhrase(lower, FLEX_PHRASES)) {
    return { action: "vibe", target: "/neo/meet-joz", awareness: "Cross-jumping to Flex." };
  }

  if (currentPortal === "root" && hasAnyPhrase(lower, DISCOVER_PHRASES)) {
    return { action: "discover", target: "/neo/meet-joz", awareness: "Cross-jumping to Ascend." };
  }

  if (currentPortal === "root" && hasAnyPhrase(lower, SKILLS_PHRASES)) {
    return { action: "skills", target: "/neo/meet-joz", awareness: "Cross-jumping to Mogg." };
  }

  if (currentPortal === "the-vibe-energy" || currentPortal === "maxx") {
    if (hasAnyPhrase(lower, FLEX_PHRASES)) {
      return {
        action: "vibe",
        target: "/neo/meet-joz",
        awareness: "Cross-jumping to Flex.",
      };
    }

    if (hasAnyPhrase(lower, DISCOVER_PHRASES)) {
      return {
        action: "discover",
        target: "/neo/meet-joz",
        awareness: "Cross-jumping to Ascend.",
      };
    }

    if (hasAnyPhrase(lower, SKILLS_PHRASES)) {
      return {
        action: "skills",
        target: "/neo/meet-joz",
        awareness: "Cross-jumping to Mogg.",
      };
    }

    if (hasAnyPhrase(lower, PAUSE_PHRASES)) {
      return {
        action: "n2x_pause",
        target: null,
        awareness: "Pausing the neurons and revealing the inside of the brain.",
      };
    }

    if (hasAnyPhrase(lower, RESUME_PHRASES)) {
      return {
        action: "n2x_resume",
        target: null,
        awareness: "Returning to the neurotransmitter scene.",
      };
    }

    if (hasAnyPhrase(lower, AR_PHRASES)) {
      return {
        action: "launch_in_space_n2x",
        target: null,
        awareness: "Opening the brain scene in AR.",
      };
    }

    if (hasAnyPhrase(lower, [...BACK_PHRASES, ...EXIT_PHRASES])) {
      return { action: "back", target: "/" };
    }
  }

  if (currentPortal === "meet-joz") {
    if (hasAnyPhrase(lower, FLEX_PHRASES)) {
      return resolveMeetJozCommand(mesh, "flex");
    }

    if (hasAnyPhrase(lower, DISCOVER_PHRASES)) {
      return resolveMeetJozCommand(mesh, "discover");
    }

    if (hasAnyPhrase(lower, SKILLS_PHRASES)) {
      return resolveMeetJozCommand(mesh, "skills");
    }

    if (hasAnyPhrase(lower, BACK_PHRASES)) {
      return resolveMeetJozCommand(mesh, "back");
    }

    if (hasAnyPhrase(lower, PAUSE_PHRASES)) return resolveMeetJozCommand(mesh, "pause");
    if (hasAnyPhrase(lower, RESUME_PHRASES)) return resolveMeetJozCommand(mesh, "resume");
    if (hasAnyPhrase(lower, EXIT_PHRASES)) return resolveMeetJozCommand(mesh, "exit");
    if (hasAnyPhrase(lower, AR_PHRASES)) return resolveMeetJozCommand(mesh, "ar");
  }

  return null;
}
