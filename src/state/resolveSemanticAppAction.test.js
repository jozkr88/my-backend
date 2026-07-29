import { resolveSemanticAppAction } from "./resolveSemanticAppAction";

test("maps meet-joz vibe_back aliases to controlled helpers", () => {
  expect(
    resolveSemanticAppAction({
      action: "vibe_back",
      currentPortal: "meet-joz",
      currentMesh: "discover",
      currentMeshStage: "ascend_stop",
    })
  ).toEqual({
    kind: "controlled-helper",
    helper: "voiceBackControlledGLB",
  });

  expect(
    resolveSemanticAppAction({
      action: "vibe_back1",
      currentPortal: "meet-joz",
      currentMesh: "skills",
      currentMeshStage: "skills_stop",
    })
  ).toEqual({
    kind: "controlled-helper",
    helper: "voiceBack1ControlledGLB",
  });
});

test("maps non-portal vibe_back aliases to app actions", () => {
  expect(
    resolveSemanticAppAction({
      action: "vibe_back",
      currentPortal: "root",
    })
  ).toEqual({
    kind: "dispatch",
    type: "MEET_JOZ_BACK",
    payload: {},
  });

  expect(
    resolveSemanticAppAction({
      action: "vibe_back1",
      currentPortal: "root",
    })
  ).toEqual({
    kind: "dispatch",
    type: "MEET_JOZ_BACK1",
    payload: {},
  });
});

test("maps off-portal meet-joz semantic actions to staged navigation", () => {
  expect(
    resolveSemanticAppAction({
      action: "discover",
      currentPortal: "maxx",
    })
  ).toEqual({
    kind: "dispatch",
    type: "NAVIGATE",
    payload: {
      targetPath: "/neo/meet-joz",
      deferredAction: "discover",
      runNuclearSkillsSequence: false,
    },
  });

  expect(
    resolveSemanticAppAction({
      action: "vibe",
      currentPortal: "root",
    })
  ).toEqual({
    kind: "dispatch",
    type: "NAVIGATE",
    payload: {
      targetPath: "/neo/meet-joz",
      deferredAction: "vibe",
      runNuclearSkillsSequence: false,
    },
  });

  expect(
    resolveSemanticAppAction({
      action: "skills",
      currentPortal: "maxx",
    })
  ).toEqual({
    kind: "dispatch",
    type: "NAVIGATE",
    payload: {
      targetPath: "/neo/meet-joz",
      deferredAction: "skills",
      runNuclearSkillsSequence: true,
    },
  });
});
