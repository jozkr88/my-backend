import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTranscript } from "./think-logic.js";
import { resolveAgenticAction } from "./world-agent.js";
import { buildAgentSnapshot } from "./full-agent.js";

test("structured transitions route root portal commands deterministically", () => {
  const result = resolveAgenticAction({
    clean: normalizeTranscript("enter the mind"),
    currentPortal: "root",
    currentMesh: "brain",
    agentContext: {
      structuredAvailableActions: ["brain", "ball"],
      structuredState: {
        transitions: [
          {
            action: "brain",
            target: "/neo/maxx",
            awareness: "Entering the Brain.",
            phrases: ["enter the brain", "enter the mind"],
          },
        ],
      },
    },
    worldMap: [],
    worldMemory: {},
  });

  assert.deepEqual(result, {
    action: "brain",
    target: "/neo/maxx",
    awareness: "Entering the Brain.",
  });
});

test("structured transitions block actions outside the current legal state", () => {
  const result = resolveAgenticAction({
    clean: normalizeTranscript("play neurons"),
    currentPortal: "the-vibe-energy",
    currentMesh: "inside_the_brain",
    agentContext: {
      structuredAvailableActions: ["n2x_pause", "back", "launch_in_space_n2x"],
      structuredState: {
        transitions: [
          {
            action: "n2x_resume",
            target: null,
            awareness: "Resuming the neurons.",
            phrases: ["play neurons", "resume neurons"],
          },
        ],
      },
    },
    worldMap: [],
    worldMemory: {},
  });

  assert.deepEqual(result, {
    action: null,
    target: null,
    awareness: "That step is not available from the current state.",
  });
});

test("agent snapshot carries structured state into the model context", () => {
  const structuredState = {
    portal: { portal_key: "the-vibe-energy" },
    state: { state_key: "neurotransmitters" },
    availableActions: ["n2x_pause", "n2x_resume", "back", "launch_in_space_n2x"],
    objects: [{ mesh: "neurotransmitters" }],
    transitions: [{ action: "n2x_pause", phrases: ["pause neurons"] }],
  };

  const snapshot = buildAgentSnapshot({
    input: "pause neurons",
    context: {
      currentPortal: "the-vibe-energy",
      currentMesh: "neurotransmitters",
      allowedActions: structuredState.availableActions,
      knownInteractiveMeshes: ["neurotransmitters"],
      structuredState,
    },
    worldMap: [],
    worldMemory: {},
  });

  assert.equal(snapshot.structuredState.state.state_key, "neurotransmitters");
  assert.deepEqual(snapshot.allowedActions, ["n2x_pause", "n2x_resume", "back", "launch_in_space_n2x"]);
});

test("agent snapshot can carry richer meet-joz semantic objects", () => {
  const structuredState = {
    portal: { portal_key: "meet-joz" },
    state: { state_key: "discover" },
    availableActions: ["discover", "pause", "resume", "back", "vibe_back", "launch_in_space_workf"],
    objects: [
      { mesh: "worldx_desktop" },
      { mesh: "capsule" },
      { mesh: "heart" },
      { mesh: "clout_maxx" },
      { mesh: "alpha_psl" },
    ],
    transitions: [{ action: "discover", phrases: ["ascend"] }],
  };

  const snapshot = buildAgentSnapshot({
    input: "ascend",
    context: {
      currentPortal: "meet-joz",
      currentMesh: "discover",
      allowedActions: structuredState.availableActions,
      knownInteractiveMeshes: ["discover", "worldx_desktop", "capsule", "heart", "clout_maxx", "alpha_psl"],
      structuredState,
    },
    worldMap: [],
    worldMemory: {},
  });

  assert.equal(snapshot.structuredState.state.state_key, "discover");
  assert.deepEqual(snapshot.structuredState.objects.map((object) => object.mesh), [
    "worldx_desktop",
    "capsule",
    "heart",
    "clout_maxx",
    "alpha_psl",
  ]);
});
