import { normalizeMeshName } from "./think-logic.js";

function rootReasoning(action) {
  if (action === "brain") {
    return {
      deterministic: "Enter the Brain",
      intent: "Go Inside the Mind",
      awareness: "This opens the abstract inside-the-brain world where signals, neurons, and memory formation are explored.",
    };
  }

  if (action === "ball") {
    return {
      deterministic: "Open Meet Joz",
      intent: "Step Into the World",
      awareness: "This enters the Meet Joz world with its surrounding environment, central capsule, and layered progression.",
    };
  }

  return null;
}

function maxxReasoning(action, currentMesh) {
  const mesh = normalizeMeshName(currentMesh);

  if (action === "n2x_pause") {
    return {
      deterministic: "Pause the Signals",
      intent: "Go Deeper Inside the Mind",
      awareness:
        mesh === "inside_the_brain"
          ? "The deeper abstract brain layer is already visible."
          : "This shifts from visible neurotransmitter flow into the deeper abstract layer inside the brain.",
    };
  }

  if (action === "n2x_resume") {
    return {
      deterministic: "Resume the Signals",
      intent: "Return to Signal Flow",
      awareness: "This returns from the deeper abstract layer to the active neurotransmitter scene.",
    };
  }

  if (action === "launch_in_space_n2x") {
    return {
      deterministic: "Launch in Space",
      intent: "Place the Brain World Around You",
      awareness: "This opens the brain experience as a spatial scene in AR.",
    };
  }

  if (action === "back") {
    return {
      deterministic: "Leave the Brain",
      intent: "Exit the Mind",
      awareness: "This returns you from the brain world back to the root portal.",
    };
  }

  return null;
}

export function buildReasoningLayers({ currentPortal, currentMesh, action }) {
  if (!action) return null;

  if (currentPortal === "root") {
    return rootReasoning(action);
  }

  if (currentPortal === "the-vibe-energy" || currentPortal === "maxx") {
    return maxxReasoning(action, currentMesh);
  }

  return null;
}

