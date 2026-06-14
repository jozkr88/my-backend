export function resolveMeetJozSemanticCommand(layer, commandKey) {
  const currentLayer = String(layer || "").toLowerCase().trim();
  const key = String(commandKey || "").toLowerCase().trim();

  if (!key) return null;

  if (key === "flex") {
    if (currentLayer === "vibe") {
      return { action: "discover", target: null, awareness: "Opening Ascend." };
    }
    if (currentLayer === "discover") {
      return { action: "vibe", target: null, awareness: "Returning to Flex." };
    }
    if (currentLayer === "skills") {
      return { action: "vibe", target: null, awareness: "Returning to Flex." };
    }
    return { action: null, target: null, awareness: "Flex is the first step." };
  }

  if (key === "discover") {
    if (currentLayer === "discover") {
      return { action: "discover", target: null, awareness: "Opening Ascend." };
    }
    if (currentLayer === "vibe") {
      return { action: "discover", target: null, awareness: "Opening Ascend." };
    }
    if (currentLayer === "skills") {
      return { action: "discover", target: null, awareness: "Returning to Ascend." };
    }
    return { action: "discover", target: null, awareness: "Opening Ascend." };
  }

  if (key === "skills") {
    if (currentLayer === "skills") {
      return { action: "skills", target: null, awareness: "Opening Skills." };
    }
    if (currentLayer === "discover") {
      return { action: "skills", target: null, awareness: "Playing to Mogg." };
    }
    if (currentLayer === "vibe") {
      return { action: "skills", target: null, awareness: "Playing through Ascend to Mogg." };
    }
    return { action: "skills", target: null, awareness: "Opening Mogg." };
  }

  if (key === "back") {
    if (currentLayer === "skills") return { action: "vibe_back1", target: null };
    if (currentLayer === "discover") return { action: "vibe_back", target: null };
    if (currentLayer === "vibe") return { action: "vibe_back", target: "/" };
    return { action: "vibe_back", target: null };
  }

  if (key === "pause") return { action: "pause", target: null };
  if (key === "resume") return { action: "resume", target: null };
  if (key === "exit") return { action: "back", target: "/" };
  if (key === "ar") return { action: "launch_in_space_workf", target: null };

  return null;
}
