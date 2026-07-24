import test from "node:test";
import assert from "node:assert/strict";
import { buildReasoningLayers } from "./reasoning-layers.js";

test("builds layered reasoning for entering the brain from root", () => {
  assert.deepEqual(
    buildReasoningLayers({
      currentPortal: "root",
      currentMesh: "brain",
      action: "brain",
    }),
    {
      deterministic: "Enter the Brain",
      intent: "Go Inside the Mind",
      awareness: "This opens the abstract inside-the-brain world where signals, neurons, and memory formation are explored.",
    },
  );
});

test("builds layered reasoning for pausing the maxx signal scene", () => {
  assert.deepEqual(
    buildReasoningLayers({
      currentPortal: "the-vibe-energy",
      currentMesh: "signal_flow",
      action: "n2x_pause",
    }),
    {
      deterministic: "Pause the Signals",
      intent: "Go Deeper Inside the Mind",
      awareness: "This shifts from visible neurotransmitter flow into the deeper abstract layer inside the brain.",
    },
  );
});

