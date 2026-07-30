import { resolveVoicePipeline } from "./pipeline";

test("uses backend semantic spatial intent before generic agentic routing", async () => {
  const calls = [];
  const fetchJson = jest.fn(async (url) => {
    calls.push(url);
    if (String(url).includes("/api/world-model/spatial-intent")) {
      return {
        ok: true,
        matched: true,
        source: "semantic_rules",
        confidence: 0.86,
        placement: {
          action: "experience_spatially",
          entitySet: "joz_neurons",
          entityLabel: "Joz's neurons",
          targetMode: "ar",
        },
      };
    }
    if (String(url).includes("/api/agentic")) {
      return { prediction: null };
    }
    return {};
  });

  const result = await resolveVoicePipeline({
    rawInput: "make this immersive",
    isMobile: false,
    currentPortal: "maxx",
    currentMesh: "brain",
    currentMeshStage: null,
    context: { currentPortal: "maxx" },
    detectImmediateMobileCommand: () => null,
    resolveLocalVoiceCommand: () => null,
    fetchJson,
    apiUrl: (path) => path,
  });

  expect(result).toMatchObject({
    source: "backend",
    backendMode: "semantic_spatial_intent",
    result: {
      action: "experience_spatially",
      placement: {
        entitySet: "joz_neurons",
      },
    },
  });
  expect(String(calls[0])).toContain("/api/world-model/spatial-intent");
});
