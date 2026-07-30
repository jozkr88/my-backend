import {
  buildPlacementObservedState,
  planWorldPlacement,
  resolvePlacementIntent,
} from "./placement";

test("resolves natural language skills placement into a canonical action", () => {
  expect(resolvePlacementIntent("place the skills of Joz in the world")).toMatchObject({
    action: "place_entity_set",
    entitySet: "joz_skills",
    targetMode: "virtual_world",
  });
});

test("treats experience spatially as a first-class contextual command", () => {
  expect(resolvePlacementIntent("experience the skills of Joz spatially")).toMatchObject({
    action: "experience_spatially",
    entitySet: "joz_skills",
  });
  expect(resolvePlacementIntent("experience spatially")).toMatchObject({
    action: "experience_spatially",
    entitySet: null,
  });
});

test("infers neurons for bare spatial experience inside maxx", () => {
  expect(resolvePlacementIntent("experience spatially", { currentPortal: "maxx" })).toMatchObject({
    action: "experience_spatially",
    entitySet: "joz_neurons",
    targetMode: "ar",
  });
});

test("infers skills for bare spatial experience inside meet-joz", () => {
  expect(resolvePlacementIntent("experience spatially", { currentPortal: "meet-joz" })).toMatchObject({
    action: "experience_spatially",
    entitySet: "joz_skills",
    targetMode: "ar",
  });
});

test("resolves reality and space language as AR intent", () => {
  expect(resolvePlacementIntent("show the works of Joz around me in reality")).toMatchObject({
    action: "experience_spatially",
    entitySet: "joz_works",
    targetMode: "ar",
  });
});

test("treats view skills around me as a spatial experience", () => {
  expect(resolvePlacementIntent("view skills around me")).toMatchObject({
    action: "experience_spatially",
    entitySet: "joz_skills",
    targetMode: "ar",
  });
});

test("falls back safely when an AR anchor is not available", () => {
  const request = resolvePlacementIntent("place Joz's skills in my space");
  const plan = planWorldPlacement({ request, sceneSnapshot: { arMetadata: { anchorIds: [] } } });
  expect(plan.targetMode).toBe("ar");
  expect(plan.executionMode).toBe("virtual_world_fallback");
  expect(plan.anchorAvailable).toBe(false);
});

test("placement planning is deterministic", () => {
  const request = resolvePlacementIntent("place the neurons in the world");
  const first = planWorldPlacement({ request });
  const second = planWorldPlacement({ request });
  expect(first).toEqual(second);
  expect(first.instances).toHaveLength(4);
  expect(buildPlacementObservedState({ plan: first }).placedEntityCount).toBe(4);
});
