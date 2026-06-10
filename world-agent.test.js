import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTranscript } from "./think-logic.js";
import { resolveAgenticAction } from "./world-agent.js";

const worldMap = [
  {
    name: "Enter",
    mesh: "Enter",
    synonyms: ["enter", "go inside", "brain portal", "open maxx"],
  },
  {
    name: "Discover",
    mesh: "Discover",
    synonyms: ["discover", "ascend"],
  },
  {
    name: "Skills",
    mesh: "skills",
    synonyms: ["skills", "mogg"],
  },
];

const worldMemory = {
  brain: {
    action: "portal",
    context: { target: "/neo/maxx" },
    commands: ["enter the brain", "enter the mind"],
  },
  ball: {
    action: "portal",
    context: { target: "/neo/meet-joz" },
    commands: ["meet joz", "talk to joz"],
  },
};

test("routes root commands from live world graph", () => {
  const result = resolveAgenticAction({
    clean: normalizeTranscript("enter the mind"),
    currentPortal: "root",
    currentMesh: "vibe",
    agentContext: {
      allowedActions: ["brain", "ball"],
      knownInteractiveMeshes: ["brain", "ball"],
    },
    worldMap,
    worldMemory,
  });

  assert.deepEqual(result, {
    action: "brain",
    target: "/neo/maxx",
  });
});

test("uses allowed actions as the source of truth for current state", () => {
  const result = resolveAgenticAction({
    clean: normalizeTranscript("ascend"),
    currentPortal: "meet-joz",
    currentMesh: "vibe",
    agentContext: {
      allowedActions: ["vibe", "discover", "skills", "vibe_back", "pause", "resume", "back", "launch_in_space_workf"],
      knownInteractiveMeshes: ["vibe", "discover", "skills"],
    },
    worldMap,
    worldMemory,
  });

  assert.deepEqual(result, {
    action: "discover",
    target: null,
  });
});

test("allows cross-step mogg routing from flex when the state permits it", () => {
  const result = resolveAgenticAction({
    clean: normalizeTranscript("mogg"),
    currentPortal: "meet-joz",
    currentMesh: "vibe",
    agentContext: {
      allowedActions: ["vibe", "discover", "skills", "vibe_back", "pause", "resume", "back", "launch_in_space_workf"],
      knownInteractiveMeshes: ["vibe", "discover", "skills"],
    },
    worldMap,
    worldMemory,
  });

  assert.deepEqual(result, {
    action: "skills",
    target: null,
  });
});

test("blocks matched intents that are not legal from the current state", () => {
  const result = resolveAgenticAction({
    clean: normalizeTranscript("mogg"),
    currentPortal: "meet-joz",
    currentMesh: "vibe",
    agentContext: {
      allowedActions: ["vibe", "vibe_back", "pause", "resume", "back", "launch_in_space_workf"],
      knownInteractiveMeshes: ["vibe", "discover", "skills"],
    },
    worldMap,
    worldMemory,
  });

  assert.deepEqual(result, {
    action: null,
    target: null,
    awareness: "That step is not available from the current state.",
  });
});

test("supports contact utilities from root through deterministic agent routing", () => {
  const result = resolveAgenticAction({
    clean: normalizeTranscript("contact joz"),
    currentPortal: "root",
    currentMesh: "brain",
    agentContext: {
      allowedActions: ["brain", "ball", "contact_joz", "call_joz", "show_contact_buttons", "hide_contact_buttons"],
      knownInteractiveMeshes: ["brain", "ball"],
    },
    worldMap,
    worldMemory,
  });

  assert.deepEqual(result, {
    action: "contact_joz",
    target: "mailto:joz@neomaxxing.com?subject=Hey%20Joz&body=Hi%20Joz%2C%20I%20just%20checked%20out%20your%20work!%20",
  });
});

test("resolves back action dynamically from current legal actions", () => {
  const result = resolveAgenticAction({
    clean: normalizeTranscript("go back"),
    currentPortal: "meet-joz",
    currentMesh: "skills",
    agentContext: {
      allowedActions: ["skills", "vibe_back1", "pause", "resume", "back", "launch_in_space_workf"],
      knownInteractiveMeshes: ["vibe", "discover", "skills"],
    },
    worldMap,
    worldMemory,
  });

  assert.deepEqual(result, {
    action: "vibe_back1",
    target: null,
  });
});
