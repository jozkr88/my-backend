import test from "node:test";
import assert from "node:assert/strict";
import { buildVisitorLocationReply } from "./shared/jozLlmRouter.js";

test("answers approximate visitor location questions from geo context", () => {
  const resolution = buildVisitorLocationReply("Where am I?", {
    label: "Singapore, Central Region, Singapore",
    countryCode: "SG",
    accuracy: "approximate",
  });

  assert.equal(resolution.answerSource, "visitor_geo");
  assert.match(resolution.reply, /Singapore, Central Region, Singapore/);
  assert.match(resolution.reply, /approximate/i);
});

test("does not hijack Joz location questions", () => {
  assert.equal(
    buildVisitorLocationReply("Where is Joz based?", {
      label: "Singapore",
    }),
    null
  );
});

test("explains when visitor geo is unavailable", () => {
  const resolution = buildVisitorLocationReply("What country am I in?", null);
  assert.equal(resolution.answerSource, "visitor_geo_unavailable");
  assert.match(resolution.reply, /signal is unavailable/i);
});

