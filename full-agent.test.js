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
