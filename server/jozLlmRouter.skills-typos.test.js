import assert from "node:assert/strict";
import test from "node:test";

import { composeJozLlmRouteReply, routeJozLlmQuery } from "./shared/jozLlmRouter.js";

function context() {
  return {
    currentPortal: "meet-joz",
    currentMesh: "skills",
    currentMeshStage: "skills_stop",
  };
}

test("repairs the common tre typo in a skills question", () => {
  const input = "What are tre skills of Joz?";
  const route = routeJozLlmQuery({ input, appContext: context(), legacyContext: context() });
  const resolution = composeJozLlmRouteReply({
    route,
    input,
    appContext: context(),
    legacyContext: context(),
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "capabilities_overview");
  assert.match(resolution.reply, /agentic AI architecture/i);
  assert.equal(resolution.fallbackUsed, false);
});
