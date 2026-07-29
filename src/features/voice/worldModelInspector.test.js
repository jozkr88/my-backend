import {
  getWorldModelInspectorMode,
  redactWorldModelTelemetry,
} from "./worldModelInspector";

test("inspector is disabled by default and in production developer mode", () => {
  expect(getWorldModelInspectorMode({})).toBe("off");
  expect(getWorldModelInspectorMode({
    REACT_APP_JOZ_WORLD_MODEL_INSPECTOR: "developer",
    NODE_ENV: "development",
  })).toBe("developer");
  expect(getWorldModelInspectorMode({
    REACT_APP_JOZ_WORLD_MODEL_INSPECTOR: "developer",
    NODE_ENV: "production",
  })).toBe("off");
  expect(getWorldModelInspectorMode({
    REACT_APP_JOZ_WORLD_MODEL_MODE: "shadow",
    REACT_APP_JOZ_WORLD_MODEL_INSPECTOR: "showcase",
    NODE_ENV: "production",
  })).toBe("showcase");
});

test("telemetry redaction removes prompts, identifiers, and sensitive nested fields", () => {
  const safe = redactWorldModelTelemetry({
    trajectoryId: "trajectory-safe-key",
    sessionId: "session-private",
    input: "private prompt",
    initialState: {
      portal: "root",
      userContext: { email: "person@example.com" },
      cameraFrame: "image-data",
    },
    selected: { actions: ["ball"], predictedState: { portal: "meet-joz" } },
  }, "showcase");

  expect(safe.trajectoryId).toBe("trajectory-safe-key");
  expect(safe.sessionId).toBeUndefined();
  expect(safe.input).toBeUndefined();
  expect(safe.initialState.userContext).toBeUndefined();
  expect(safe.initialState.cameraFrame).toBeUndefined();
  expect(safe.selected.actions).toEqual(["ball"]);
});
