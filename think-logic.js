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
  hasPhrase as sharedHasPhrase,
  normalizeVoiceTranscript,
} from "../src/shared/voiceCanonical.js";
import {
  isMeetJozActionAllowed,
} from "../src/shared/appWorld.js";
import { resolveMeetJozSemanticCommand } from "../src/shared/meetJozSemantics.js";
import { KNOWN_VOICE_ACTIONS, normalizeVoiceAction } from "../src/shared/voiceActions.js";

export const SITE_TARGETS = {
  maxx: "/neo/maxx",
  meetJoz: "/neo/meet-joz",
};

export const SAFE_APP_TARGETS = new Set([
  "/",
  "/neo/maxx",
  "/neo/meet-joz",
  "/vibe/the-vibe-energy",
  "/vibe/the-aura",
  "/vibe/meet-joz",
]);

export const KNOWN_ACTIONS = KNOWN_VOICE_ACTIONS;

const MEET_JOZ_FLEX_PHRASES = FLEX_PHRASES;
const MEET_JOZ_DISCOVER_PHRASES = DISCOVER_PHRASES;
const MEET_JOZ_SKILLS_PHRASES = SKILLS_PHRASES;
const MAXX_AR_PHRASES = AR_PHRASES;

export const APP_CONTEXT = {
  frontend: {
    summary: "A 3D voice-navigable portfolio world with multiple portals, animated GLB scenes, semantic text objects, and desktop/mobile-specific interactions including AR launch flows.",
    surfaces: [
      "root landing scene with a wireframe head, a brain portal, and a Meet Joz entry",
      "MAXX portal for neuroplasticity and abstract inside-the-brain storytelling",
      "meet-joz portal for identity, prestige, scale, aesthetics, work, and capability storytelling",
    ],
  },
  backend: {
    summary: "An Express voice-reasoning service that normalizes transcripts, maps user intent to a strict action set, applies portal guardrails, logs reasoning events, stores world memory, and only falls back to the LLM when deterministic routing is insufficient.",
    responsibilities: [
      "normalize speech-to-text mistakes into canonical portal language",
      "route users to safe app targets and known actions only",
      "apply portal-state restrictions so impossible transitions are blocked",
      "use world context to improve interpretation of semantic phrases",
    ],
  },
  semantics: {
    summary: "The app is not generic page navigation. Each portal is a semantic world where meshes, text, environment, and transitions carry meaning.",
    principles: [
      "users may speak loosely, but the agent should reason over strict canonical intents",
      "spoken aliases like Meet Joe's must resolve to Meet Joz",
      "portal understanding depends on current scene and current state",
      "fallback reasoning should prefer the app's known semantics over generic guesses",
    ],
  },
};

export const WORLD_CONTEXT = {
  root: {
    summary: "Cosmic landing scene with a wireframe head, a glowing brain portal, and a separate Meet Joz call-to-action.",
    semantics: [
      "enter, go inside, open the portal, or enter the brain opens the MAXX portal",
      "asking why at root means the user wants the philosophical brain journey and should enter MAXX",
      "ball or Meet Joz opens the meet-joz portal",
    ],
  },
  "the-vibe-energy": {
    summary: "The MAXX explainer portal. It is an abstract inside-the-brain environment rather than literal outer space.",
    assets: {
      neurotransmitters: {
        role: "Primary neuron explainer scene",
        meaning: [
          "Contains the Human Neuron and AI Neuron comparison",
          "Shows the educational animation about new experience formation, neuroplasticity, and neurogenesis",
          "The glossy balls with holes symbolize neurotransmitters",
        ],
      },
      insideTheBrain: {
        role: "Secondary inside-the-brain layer",
        meaning: [
          "Contains The Elite Beauty, Ascension, and 10/10 Frame Mogg",
          "Represents a deeper abstract inside-the-brain layer after the explainer",
        ],
      },
      neurotransmitters: {
        role: "Large glossy balls with holes",
        meaning: "Animated neurotransmitter forms moving through the abstract brain environment",
      },
      environment: {
        role: "Portal environment",
        meaning: "Abstract inside-brain space rendered with cosmic visual language",
      },
    },
    interactions: [
      "Clicking the main neuron explainer reveals the deeper inside-the-brain layer",
      "Spatial Capability acts as a desktop button to show the deeper inside-the-brain layer",
      "On mobile, Spatial Capability opens AR",
      "On desktop, saying pause reveals the deeper inside-the-brain layer and saying play or resume returns to the neurotransmitter scene",
      "On mobile, saying view in space or space maxx opens AR",
      "From MAXX, flex, ascend, and mogg or skills can cross-jump into the sequential Meet Joz portal",
    ],
  },
  "meet-joz": {
    summary: "A sequential semantic portal around Joz. It progresses through an entry world, an ascend/clout/scale layer, and a deeper skills/work/capability layer, and it can visually unwind backward to earlier states and back to root.",
    assets: {
      worldx: {
        file: "worldx.glb",
        role: "Primary meet-joz surrounding world",
        meaning: [
          "Reflective cylindrical chamber that acts as the main semantic environment of the portal",
          "Contains the central capsule interaction object, framed world panels, semantic text clusters, and prestige/capability motifs",
          "Surrounds the user throughout forward and backward progression of the meet-joz sequence",
          "It is not the interactive trigger object",
        ],
      },
      worldxMobile: {
        file: "worldx-m.glb",
        role: "Mobile variant of the meet-joz surrounding world",
        meaning: "Same semantic world as worldx.glb, adapted for mobile presentation",
      },
      model1: {
        file: "model1.glb",
        role: "Primary interactive meet-joz object",
        meaning: [
          "This is the interactive object the user is meant to trigger inside the meet-joz portal",
          "Use this as the canonical interactive target rather than worldx.glb",
        ],
      },
      heart: {
        role: "Ascend anchor",
        meaning: "The neon heart construct marks the prestige, attraction, emotional intensity, and transformation layer of Ascend",
      },
      capsule: {
        role: "Central interaction object",
        meaning: "The gold-and-white capsule sits at the center of the world and acts like the focal trigger or portal object",
      },
      aiClusters: {
        role: "Chrome node clusters",
        meaning: [
          "AI Synthesis",
          "AI Analysis",
          "connection-making, intelligence, and structured cognition motifs",
        ],
      },
      atmosPanel: {
        role: "Atmos MAXX panel",
        meaning: "Environmental/aura destination panel within the worldx semantic environment",
      },
      alphaPanel: {
        role: "Alpha PSL / Dubai panel",
        meaning: "Prestige, execution, and regional proof-point tile inside the ascend layer",
      },
      worldClassPanel: {
        role: "World-Class / Singapore panel",
        meaning: "Global capability and international proof-point tile inside the ascend layer",
      },
    },
    stateSemantics: {
      vibe: {
        aliases: ["vibe", "flex"],
        meaning: [
          "Entry into the meet-joz world",
          "Activates worldx.glb as the surrounding semantic environment",
          "Introduces the user to the Joz portal before deeper progression",
        ],
      },
      discover: {
        aliases: ["discover", "ascend"],
        meaning: [
          "Prestige, clout, scale, aura, and transformation state",
          "Associated with the heart construct, Clout MAXX, Scale MAXX, Alpha PSL, World-Class, Atmos MAXX, and aesthetic or aura phrases",
          "This is the second step and should not be opened before Flex/Vibe",
        ],
      },
      skills: {
        aliases: ["skills", "mogg"],
        meaning: [
          "Work, credentials, execution, enterprise capability, and institutional proof state",
          "Associated with deeper capability content such as Skills, major institutions, and professional proof-points",
          "This is the third step and should not be opened before Ascend/Discover",
        ],
      },
    },
    interactions: [
      "Flex or Vibe opens the meet-joz entry world",
      "worldx.glb is the surrounding semantic environment and is not itself interactive",
      "model1.glb is the main interactive object inside meet-joz",
      "Ascend or Discover opens the prestige, clout, scale, heart, and world-panel layer",
      "Mogg or Skills opens the deeper work and capability layer",
      "Back from skills unwinds one layer to discover",
      "Back from discover unwinds one layer to vibe",
      "Back from vibe exits the portal to root",
      "The sequence visually plays forward and backward rather than just swapping static screens",
      "Launch in space opens the meet-joz AR object",
    ],
  },
};

export function hasPhrase(text, phrases) {
  return sharedHasPhrase(text, phrases);
}

export function getWorldContext(currentPortal) {
  return WORLD_CONTEXT[currentPortal] || null;
}

export function normalizeTranscript(text) {
  return normalizeVoiceTranscript(text);
}

export function safeTarget(value) {
  if (typeof value !== "string") return null;
  if (value.startsWith("mailto:") || value.startsWith("tel:")) return value;
  return SAFE_APP_TARGETS.has(value) ? value : null;
}

export function normalizeMeshName(mesh) {
  const lower = String(mesh || "").toLowerCase().trim();
  if (!lower) return "";
  if (/(^|\b)(vibe|flex)(\b|$)/.test(lower)) return "vibe";
  if (/(^|\b)(discover|ascend)(\b|$)/.test(lower)) return "discover";
  if (/(^|\b)(skills|mogg)(\b|$)/.test(lower)) return "skills";
  return lower;
}

export function canonicalTargetForMesh(mesh) {
  switch (mesh) {
    case "brain":
    case "enter_portal":
    case "vibe":
      return SITE_TARGETS.maxx;
    case "ball":
      return SITE_TARGETS.meetJoz;
    default:
      return null;
  }
}

export function normalizeAction(action) {
  return normalizeVoiceAction(action);
}

export function detectMeetJozCommandKey(clean) {
  if (hasPhrase(clean, MEET_JOZ_FLEX_PHRASES)) return "flex";
  if (hasPhrase(clean, MEET_JOZ_DISCOVER_PHRASES)) return "ascend";
  if (hasPhrase(clean, MEET_JOZ_SKILLS_PHRASES)) return "mogg";
  if (hasPhrase(clean, BACK_PHRASES)) return "back";
  if (hasPhrase(clean, PAUSE_PHRASES)) return "pause";
  if (hasPhrase(clean, RESUME_PHRASES)) return "resume";
  if (hasPhrase(clean, EXIT_PHRASES)) return "exit";
  if (hasPhrase(clean, MAXX_AR_PHRASES)) return "launch";
  return null;
}

export function applyMeetJozGuardrails(result, currentMesh) {
  if (!result) return result;

  const mesh = normalizeMeshName(currentMesh);
  const action = normalizeAction(result.action);

  if (!mesh || !action) return result;
  if (isMeetJozActionAllowed(mesh, action)) return { ...result, action };

  return {
    action: null,
    target: null,
    awareness: "That step is not available from the current state.",
  };
}

export function classifyRootCommand(clean) {
  if (hasPhrase(clean, ROOT_BRAIN_PHRASES)) {
    return { action: "brain", target: SITE_TARGETS.maxx };
  }

  if (hasPhrase(clean, ROOT_MEET_JOZ_PHRASES)) {
    return { action: "ball", target: SITE_TARGETS.meetJoz };
  }

  if (hasPhrase(clean, SURPRISE_ME_PHRASES)) {
    return { action: "skills", target: SITE_TARGETS.meetJoz, awareness: "Going nuclear to Skills." };
  }

  if (hasPhrase(clean, MEET_JOZ_FLEX_PHRASES)) {
    return { action: "vibe", target: SITE_TARGETS.meetJoz, awareness: "Cross-jumping to Flex." };
  }

  if (hasPhrase(clean, MEET_JOZ_DISCOVER_PHRASES)) {
    return { action: "discover", target: SITE_TARGETS.meetJoz, awareness: "Cross-jumping to Ascend." };
  }

  if (hasPhrase(clean, MEET_JOZ_SKILLS_PHRASES)) {
    return { action: "skills", target: SITE_TARGETS.meetJoz, awareness: "Cross-jumping to Mogg." };
  }

  return null;
}

export function classifyMeetJozCommand(clean, currentMesh) {
  const mesh = normalizeMeshName(currentMesh);

  if (hasPhrase(clean, SURPRISE_ME_PHRASES)) {
    if (mesh === "skills") return { action: "skills", target: null, awareness: "Going nuclear to Skills." };
    return { action: "skills", target: null, awareness: "Going nuclear to Skills." };
  }

  if (hasPhrase(clean, MEET_JOZ_FLEX_PHRASES)) return resolveMeetJozSemanticCommand(mesh, "flex");
  if (hasPhrase(clean, MEET_JOZ_DISCOVER_PHRASES)) return resolveMeetJozSemanticCommand(mesh, "discover");
  if (hasPhrase(clean, MEET_JOZ_SKILLS_PHRASES)) return resolveMeetJozSemanticCommand(mesh, "skills");
  if (hasPhrase(clean, BACK_PHRASES)) return resolveMeetJozSemanticCommand(mesh, "back");
  if (hasPhrase(clean, PAUSE_PHRASES)) return resolveMeetJozSemanticCommand(mesh, "pause");
  if (hasPhrase(clean, RESUME_PHRASES)) return resolveMeetJozSemanticCommand(mesh, "resume");
  if (hasPhrase(clean, EXIT_PHRASES)) return resolveMeetJozSemanticCommand(mesh, "exit");
  if (hasPhrase(clean, MAXX_AR_PHRASES)) return resolveMeetJozSemanticCommand(mesh, "ar");

  return null;
}

export function classifyUtilityCommand(clean) {
  if (hasPhrase(clean, CONTACT_PHRASES)) {
    return {
      action: "contact_joz",
      target: "mailto:joz@neomaxxing.com?subject=Hey%20Joz&body=Hi%20Joz%2C%20I%20just%20checked%20out%20your%20work!%20",
      awareness: "Opening your email app to contact Joz at joz@neomaxxing.com.",
    };
  }

  if (hasPhrase(clean, CALL_PHRASES)) {
    return {
      action: "call_joz",
      target: "tel:+41764973894",
      awareness: "Tap here to call Joz",
    };
  }

  if (hasPhrase(clean, HIDE_CONTACT_PHRASES)) {
    return {
      action: "hide_contact_buttons",
      target: null,
      awareness: "Contact button hidden. Say 'show contact' to bring it back.",
    };
  }

  if (hasPhrase(clean, SHOW_CONTACT_PHRASES)) {
    return {
      action: "show_contact_buttons",
      target: null,
      awareness: "Contact button visible again.",
    };
  }

  return null;
}

export function classifyMaxxCommand(clean) {
  if (hasPhrase(clean, PAUSE_PHRASES)) {
    return {
      action: "n2x_pause",
      target: null,
      awareness: "Pausing the neurons and revealing the inside of the brain.",
    };
  }

  if (hasPhrase(clean, RESUME_PHRASES)) {
    return {
      action: "n2x_resume",
      target: null,
      awareness: "Returning to the neurotransmitter scene.",
    };
  }

  if (hasPhrase(clean, MAXX_AR_PHRASES)) {
    return {
      action: "launch_in_space_n2x",
      target: null,
      awareness: "Opening the brain scene in AR.",
    };
  }

  if (hasPhrase(clean, [...BACK_PHRASES, ...EXIT_PHRASES])) {
    return { action: "back", target: "/" };
  }

  return null;
}

export function classifyGlobalCommand(clean, currentPortal) {
  if (hasPhrase(clean, SURPRISE_ME_PHRASES)) {
    return {
      action: "skills",
      target: SITE_TARGETS.meetJoz,
      awareness: "Going nuclear to Skills.",
    };
  }

  if (currentPortal === "the-vibe-energy" && hasPhrase(clean, MAXX_AR_PHRASES)) {
    return {
      action: "launch_in_space_n2x",
      target: null,
      awareness: "Opening the brain scene in AR.",
    };
  }

  if (currentPortal === "meet-joz" && hasPhrase(clean, MAXX_AR_PHRASES)) {
    return { action: "launch_in_space_workf", target: null };
  }

  if (hasPhrase(clean, EXIT_PHRASES)) {
    return { action: "back", target: "/" };
  }

  if (currentPortal === "root" && hasPhrase(clean, BACK_PHRASES)) {
    return { action: null, target: null };
  }

  return null;
}
