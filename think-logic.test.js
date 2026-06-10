import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMeetJozGuardrails,
  classifyGlobalCommand,
  classifyMaxxCommand,
  classifyMeetJozCommand,
  classifyRootCommand,
  classifyUtilityCommand,
  normalizeTranscript,
} from "./think-logic.js";

test("normalizes speech-to-text aliases", () => {
  assert.equal(normalizeTranscript("Meet Joe's"), "meet joz");
  assert.equal(normalizeTranscript("talk to Jose"), "talk to joz");
  assert.equal(normalizeTranscript("space max"), "space maxx");
  assert.equal(normalizeTranscript("accent"), "ascend");
  assert.equal(normalizeTranscript("mug"), "mogg");
});

test("classifies root portal commands", () => {
  assert.deepEqual(classifyRootCommand(normalizeTranscript("enter the brain")), {
    action: "brain",
    target: "/neo/maxx",
  });

  assert.deepEqual(classifyRootCommand(normalizeTranscript("meet joe's")), {
    action: "ball",
    target: "/neo/meet-joz",
  });

  assert.deepEqual(classifyRootCommand(normalizeTranscript("surprise me")), {
    action: "skills",
    target: "/neo/meet-joz",
    awareness: "Going nuclear to Skills.",
  });
});

test("classifies utility commands", () => {
  assert.equal(classifyUtilityCommand(normalizeTranscript("send an email")).action, "contact_joz");
  assert.equal(classifyUtilityCommand(normalizeTranscript("call joz")).action, "call_joz");
});

test("classifies MAXX commands", () => {
  assert.equal(classifyMaxxCommand(normalizeTranscript("pause")).action, "n2x_pause");
  assert.equal(classifyMaxxCommand(normalizeTranscript("play")).action, "n2x_resume");
  assert.equal(classifyMaxxCommand(normalizeTranscript("space max")).action, "launch_in_space_n2x");
});

test("classifies meet-joz stateful commands", () => {
  assert.deepEqual(classifyMeetJozCommand(normalizeTranscript("ascend"), "vibe"), {
    action: "discover",
    target: null,
    awareness: "Opening Ascend.",
  });

  assert.deepEqual(classifyMeetJozCommand(normalizeTranscript("ascend"), "discover"), {
    action: "discover",
    target: null,
    awareness: "Opening Mogg.",
  });

  assert.deepEqual(classifyMeetJozCommand(normalizeTranscript("flex"), "skills"), {
    action: "vibe",
    target: null,
    awareness: "Returning to Flex.",
  });

  assert.deepEqual(classifyMeetJozCommand(normalizeTranscript("mogg"), "vibe"), {
    action: "skills",
    target: null,
    awareness: "Cross-jumping to Mogg.",
  });

  assert.deepEqual(classifyMeetJozCommand(normalizeTranscript("back"), "skills"), {
    action: "vibe_back1",
    target: null,
  });
});

test("blocks invalid meet-joz transitions", () => {
  assert.deepEqual(
    applyMeetJozGuardrails({ action: "n2x_pause", target: null }, "vibe"),
    {
      action: null,
      target: null,
      awareness: "That step is not available from the current state.",
    },
  );
});

test("classifies global commands", () => {
  assert.equal(classifyGlobalCommand(normalizeTranscript("view in space"), "meet-joz").action, "launch_in_space_workf");
  assert.deepEqual(classifyGlobalCommand(normalizeTranscript("surprise me"), "maxx"), {
    action: "skills",
    target: "/neo/meet-joz",
    awareness: "Going nuclear to Skills.",
  });
  assert.deepEqual(classifyGlobalCommand(normalizeTranscript("back"), "root"), {
    action: null,
    target: null,
  });
});
