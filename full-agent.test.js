import test from "node:test";
import assert from "node:assert/strict";
import { approveAgentProposal, buildAgentSnapshot } from "./full-agent.js";

const worldMap = [
  { name: "Enter", mesh: "Enter", synonyms: ["enter", "open maxx"] },
  { name: "Skills", mesh: "skills", synonyms: ["skills", "mogg"] },
];

const worldMemory = {
  brain: {
    action: "portal",
    context: { target: "/neo/maxx" },
    commands: ["enter the brain", "enter the mind"],
  },
};

test("builds an agent snapshot from world state", () => {
  const snapshot = buildAgentSnapshot({
    input: "enter the mind",
    context: {
      currentPortal: "root",
      currentMesh: "brain",
      allowedActions: ["brain", "ball"],
      knownInteractiveMeshes: ["brain", "ball"],
    },
    worldMap,
    worldMemory,
  });

  assert.equal(snapshot.currentPortal, "root");
  assert.equal(snapshot.currentMesh, "brain");
  assert.equal(snapshot.normalizedInput, "enter the mind");
  assert.equal(snapshot.allowedActions.length, 2);
  assert.equal(snapshot.contentAwareness?.portal?.id, "root");
  assert.equal(snapshot.contentAwareness?.focusedObject?.id, "root_brain");
  assert.deepEqual(snapshot.contentAwareness?.visibleObjects?.map((object) => object.id), [
    "root_gold_pill",
    "root_brain",
    "root_enter",
    "root_moon_environment",
  ]);
});

test("deterministic route overrides any open-ended proposal", () => {
  const approved = approveAgentProposal({
    clean: "enter the mind",
    context: {
      currentPortal: "root",
      currentMesh: "brain",
      allowedActions: ["brain", "ball"],
      knownInteractiveMeshes: ["brain", "ball"],
    },
    worldMap,
    worldMemory,
    proposal: {
      proposedAction: "skills",
      proposedTarget: null,
      response: "Opening skills.",
    },
  });

  assert.deepEqual(approved, {
    action: "brain",
    target: "/neo/maxx",
    awareness: null,
    source: "deterministic",
  });
});

test("agent proposals are blocked when outside legal actions", () => {
  const approved = approveAgentProposal({
    clean: "show me mogg",
    context: {
      currentPortal: "meet-joz",
      currentMesh: "vibe",
      allowedActions: ["vibe", "vibe_back", "pause", "resume", "back"],
      knownInteractiveMeshes: ["vibe", "discover", "skills"],
    },
    worldMap,
    worldMemory,
    proposal: {
      proposedAction: "skills",
      proposedTarget: null,
      response: "Opening skills.",
    },
  });

  assert.deepEqual(approved, {
    action: null,
    target: null,
    awareness: "That step is not available from the current state.",
    source: "deterministic",
  });
});

test("legal agent proposals pass when deterministic does not resolve first", () => {
  const approved = approveAgentProposal({
    clean: "show contact",
    context: {
      currentPortal: "root",
      currentMesh: "brain",
      allowedActions: ["brain", "ball"],
      knownInteractiveMeshes: ["brain", "ball"],
    },
    worldMap,
    worldMemory,
    proposal: {
      proposedAction: "show_contact_buttons",
      proposedTarget: null,
      response: "Showing contact buttons.",
    },
  });

  assert.deepEqual(approved, {
    action: "show_contact_buttons",
    target: null,
    awareness: "Showing contact buttons.",
    source: "agent_proposal",
  });
});

test("agent snapshot can carry canonical maxx content awareness", () => {
  const snapshot = buildAgentSnapshot({
    input: "show me the neurons",
    context: {
      currentPortal: "the-vibe-energy",
      currentMesh: "neurotransmitters",
      currentPhase: "signal_flow",
      allowedActions: ["n2x_pause", "n2x_resume", "back", "launch_in_space_n2x"],
      knownInteractiveMeshes: ["neurotransmitters", "human neuron", "ai neuron"],
    },
    worldMap,
    worldMemory,
  });

  assert.equal(snapshot.contentAwareness?.portal?.id, "maxx");
  assert.equal(snapshot.contentAwareness?.stage?.id, "maxx_signal_transfer");
  assert.equal(snapshot.contentAwareness?.focusedObject?.id, "maxx_neurons");
});

test("agent snapshot can carry canonical meet-joz sequence awareness", () => {
  const snapshot = buildAgentSnapshot({
    input: "show mogg",
    context: {
      currentPortal: "meet-joz",
      currentMesh: "skills",
      currentMeshStage: "skills_stop",
      allowedActions: ["skills", "vibe_back1", "pause", "resume", "back", "launch_in_space_workf"],
      knownInteractiveMeshes: ["vibe", "discover", "skills", "workf"],
    },
    worldMap,
    worldMemory,
  });

  assert.equal(snapshot.contentAwareness?.portal?.id, "meet_joz");
  assert.equal(snapshot.contentAwareness?.focusedObject?.id, "meet_joz_mogg");
  assert.equal(snapshot.contentAwareness?.stage?.id, "meet_joz_mogg_stage");
  assert.equal(snapshot.intentRouting?.route, "world_awareness");
});

test("agent snapshot can distinguish meet-joz workf from mogg when content mode is provided", () => {
  const snapshot = buildAgentSnapshot({
    input: "show skills layer",
    context: {
      currentPortal: "meet-joz",
      currentMesh: "skills",
      currentMeshStage: "skills_stop",
      contentMode: "workf",
      allowedActions: ["skills", "vibe_back1", "pause", "resume", "back", "launch_in_space_workf"],
      knownInteractiveMeshes: ["vibe", "discover", "skills", "workf"],
    },
    worldMap,
    worldMemory,
  });

  assert.equal(snapshot.contentAwareness?.focusedObject?.id, "meet_joz_skills");
  assert.equal(snapshot.contentAwareness?.stage?.id, "meet_joz_skills_stage");
});

test("agent snapshot can distinguish meet-joz skills panel from workf when content mode is provided", () => {
  const snapshot = buildAgentSnapshot({
    input: "show skills panel",
    context: {
      currentPortal: "meet-joz",
      currentMesh: "skills",
      currentMeshStage: "skills_stop",
      contentMode: "jkx",
      allowedActions: ["skills", "vibe_back1", "pause", "resume", "back", "launch_in_space_workf"],
      knownInteractiveMeshes: ["vibe", "discover", "skills", "workf"],
    },
    worldMap,
    worldMemory,
  });

  assert.equal(snapshot.contentAwareness?.focusedObject?.id, "meet_joz_skills_panel");
  assert.equal(snapshot.contentAwareness?.stage?.id, "meet_joz_skills_stage");
});
