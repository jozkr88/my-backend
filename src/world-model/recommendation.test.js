import {
  buildWorldModelRecommendationContext,
  recordWorldModelRecommendationSelection,
  requestWorldModelRecommendations,
} from "./recommendation";

test("builds a contextual recommendation state from device, AR, and audience signals", () => {
  const context = buildWorldModelRecommendationContext({
    currentPortal: "maxx",
    currentMesh: "brain",
    currentPhase: "neurons",
    isMobile: true,
    arSupported: true,
    agentContext: { audience: "recruiter" },
  });

  expect(context).toMatchObject({
    currentPortal: "maxx",
    currentMesh: "brain",
    currentPhase: "neurons",
    isMobile: true,
    arSupported: true,
    audience: "recruiter",
  });
  expect(["morning", "workday", "evening", "night"]).toContain(context.dayPart);
});

test("keeps recommendation actions limited to the two visible World Model buttons", async () => {
  const previousFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify({
      selectedActions: ["enter_brain", "show_neurons", "show_skills"],
      candidates: [],
    })),
  });

  try {
    const result = await requestWorldModelRecommendations({ currentPortal: "root" });
    expect(result.selectedActions).toEqual(["show_neurons", "show_skills"]);
  } finally {
    global.fetch = previousFetch;
  }
});

test("records a selected recommendation as an observed outcome", async () => {
  const previousFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify({ ok: true, trajectoryId: "trajectory-1" })),
  });

  try {
    await recordWorldModelRecommendationSelection({
      recommendation: {
        recommendationId: "recommendation-1",
        stateKey: "world-model-recommendation:recruiter:morning:desktop:unsupported:root",
        modelVersion: "contextual-intro-v1",
        candidates: [{ action: "show_skills", score: 0.91, confidence: 0.7 }],
      },
      context: {
        currentPortal: "root",
        audience: "recruiter",
        dayPart: "morning",
        device: "desktop",
        arSupported: false,
      },
      action: "show_skills",
    });

    const [, request] = global.fetch.mock.calls[0];
    const body = JSON.parse(request.body);
    expect(body).toMatchObject({
      intent: "intro_recommendation",
      success: true,
      proposedAction: { type: "show_skills" },
      observedState: { stage: "selected" },
    });
  } finally {
    global.fetch = previousFetch;
  }
});
