import { normalizeVoiceTranscript } from "./voiceCanonical";

test("normalizes plex to flex", () => {
  expect(normalizeVoiceTranscript("plex")).toBe("flex");
});

test("normalizes meet jaws to meet joz", () => {
  expect(normalizeVoiceTranscript("meet jaws")).toBe("meet joz");
  expect(normalizeVoiceTranscript("neo meet jaws")).toBe("neo meet joz");
  expect(normalizeVoiceTranscript("talk to jaws")).toBe("talk to joz");
});

test("normalizes mark to mogg", () => {
  expect(normalizeVoiceTranscript("mark")).toBe("mogg");
});

test("normalizes entered the brain to enter the brain", () => {
  expect(normalizeVoiceTranscript("entered the brain")).toBe("enter the brain");
  expect(normalizeVoiceTranscript("entered brain")).toBe("enter the brain");
});
