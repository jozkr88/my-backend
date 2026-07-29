import { getCrossJumpSequence } from "./crossJumping";

test.each([
  ["/", "vibe", ["vibe"]],
  ["/neo/maxx", "discover", ["vibe", "discover_crossjump"]],
  ["maxx", "skills", ["vibe", "discover", "skills"]],
  ["/neo/maxx", "ascend", ["vibe", "discover_crossjump"]],
  ["/neo/maxx", "mogg", ["vibe", "discover", "skills"]],
])("cross-jumps %s to %s through the click sequence", (sourcePortal, action, expected) => {
  expect(
    getCrossJumpSequence({
      sourcePortal,
      targetPortal: "/neo/meet-joz",
      action,
    })
  ).toEqual(expected);
});

test("does not create a cross-jump inside Meet Joz", () => {
  expect(
    getCrossJumpSequence({
      sourcePortal: "meet-joz",
      targetPortal: "meet-joz",
      action: "discover",
    })
  ).toBeNull();
});

test("keeps a deferred sequence when the saved source path is stale", () => {
  expect(
    getCrossJumpSequence({
      sourcePortal: "/neo/meet-joz",
      targetPortal: "/neo/meet-joz",
      action: "mogg",
      deferredNavigation: true,
    })
  ).toEqual(["vibe", "discover", "skills"]);
});
