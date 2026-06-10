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
    currentMesh: "discover",
    agentContext: {
      allowedActions: ["discover", "vibe_back", "pause", "resume", "back", "launch_in_space_workf"],
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
