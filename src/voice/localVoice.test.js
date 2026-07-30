import { detectImmediateMobileCommand, resolveLocalVoiceCommand } from "./localVoice";

test("cross-jumps from maxx to ascend in meet-joz", () => {
  expect(resolveLocalVoiceCommand("ascend", "maxx", null, null)).toEqual({
    action: "discover",
    target: "/neo/meet-joz",
    awareness: "Cross-jumping to Ascend.",
  });
});

test("cross-jumps from maxx to flex in meet-joz", () => {
  expect(resolveLocalVoiceCommand("flex", "maxx", null, null)).toEqual({
    action: "vibe",
    target: "/neo/meet-joz",
    awareness: "Cross-jumping to Flex.",
  });
});

test("cross-jumps from maxx to mogg in meet-joz", () => {
  expect(resolveLocalVoiceCommand("mogg", "maxx", null, null)).toEqual({
    action: "skills",
    target: "/neo/meet-joz",
    awareness: "Cross-jumping to Mogg.",
  });
});

test("does not misclassify why-questions as brain navigation", () => {
  expect(resolveLocalVoiceCommand("Why should we hire Joz?", "root", null, null)).toBeNull();
});

test("keeps spatial skills requests out of the Mogg shortcut", () => {
  expect(detectImmediateMobileCommand("view skills around me")).toBeNull();
  expect(resolveLocalVoiceCommand("view skills around me", "root", null, null)).toMatchObject({
    action: "experience_spatially",
    placement: {
      entitySet: "joz_skills",
      targetMode: "ar",
    },
  });
});

test("keeps plain skills commands on the normal desktop skills route", () => {
  expect(resolveLocalVoiceCommand("show skills", "root", null, null)).toEqual({
    action: "skills",
    target: "/neo/meet-joz",
    awareness: "Cross-jumping to Mogg.",
  });
});

test("keeps plain neuron commands on the normal desktop brain route", () => {
  expect(resolveLocalVoiceCommand("show neurons", "root", null, null)).toEqual({
    action: "brain",
    target: "/neo/maxx",
    awareness: "Entering the Brain…",
  });
});
