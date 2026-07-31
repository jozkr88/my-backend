import {
  buildWholeAppWorldState,
  recordWholeAppJourneyEvent,
} from "./appJourney";

test("builds a privacy-safe whole-app state from the current journey", () => {
  const state = buildWholeAppWorldState({
    appState: {
      currentPortal: "meet-joz",
      currentMesh: "skills",
      currentMeshStage: "skills_stop",
      currentPath: "/neo/meet-joz",
      uiState: { isMobile: true, arSupported: true },
      allowedActions: ["skills", "back"],
    },
    overrides: { action: "show_skills" },
  });

  expect(state).toMatchObject({
    currentStateKey: "meet-joz:skills:skills_stop",
    portal: "meet-joz",
    path: "/neo/meet-joz",
    mesh: "skills",
    stage: "skills_stop",
    isMobile: true,
    arSupported: true,
    allowedActions: ["skills", "back"],
    goal: "explore_skills",
  });
  expect(state).not.toHaveProperty("prompt");
  expect(state).not.toHaveProperty("transcript");
});

test("records a whole-app event without sending raw user input", async () => {
  const previousFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify({ ok: true })),
  });

  try {
    await recordWholeAppJourneyEvent({
      action: "ask_joz",
      target: "chat",
      source: "joz_chat",
      outcomeType: "question_submitted",
      appState: {
        currentPortal: "root",
        currentPath: "/",
        allowedActions: ["brain", "ball"],
      },
    });

    const [, request] = global.fetch.mock.calls[0];
    const body = JSON.parse(request.body);
    expect(body).toMatchObject({
      intent: "whole_app_journey",
      goal: "get_an_answer",
      proposedAction: { type: "ask_joz", target: "chat", source: "joz_chat" },
      observedState: { outcomeType: "question_submitted" },
      success: true,
    });
    expect(body).not.toHaveProperty("input");
    expect(body).not.toHaveProperty("prompt");
    expect(body).not.toHaveProperty("transcript");
  } finally {
    global.fetch = previousFetch;
  }
});
