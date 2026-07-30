import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveSemanticSpatialIntent,
  resolveSemanticSpatialIntentWithModel,
} from "./semanticSpatialIntent.js";

test("infers neurons from immersive language inside maxx", () => {
  const result = resolveSemanticSpatialIntent("make this immersive", {
    currentPortal: "maxx",
  });
  assert.equal(result.matched, true);
  assert.equal(result.placement.entitySet, "joz_neurons");
  assert.equal(result.placement.action, "experience_spatially");
});

test("infers skills from walk-through language inside meet-joz", () => {
  const result = resolveSemanticSpatialIntent("let me walk through it", {
    currentPortal: "meet-joz",
  });
  assert.equal(result.matched, true);
  assert.equal(result.placement.entitySet, "joz_skills");
});

test("keeps ordinary questions out of spatial routing", () => {
  const result = resolveSemanticSpatialIntent("what business outcomes has Joz delivered", {
    currentPortal: "meet-joz",
  });
  assert.equal(result.matched, false);
});

test("uses optional model classification for ambiguous spatial requests", async () => {
  const calls = [];
  const openai = {
    chat: {
      completions: {
        create: async (request) => {
          calls.push(request);
          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  matched: true,
                  entitySet: "joz_skills",
                  action: "experience_spatially",
                  confidence: 0.91,
                }),
              },
            }],
          };
        },
      },
    },
  };
  const result = await resolveSemanticSpatialIntentWithModel({
    input: "can I see this on my phone",
    context: {},
    openai,
    model: "test-model",
  });

  assert.equal(result.matched, true);
  assert.equal(result.source, "semantic_model");
  assert.equal(result.placement.entitySet, "joz_skills");
  assert.equal(calls.length, 1);
});
