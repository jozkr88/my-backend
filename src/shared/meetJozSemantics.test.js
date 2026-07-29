import { resolveMeetJozSemanticCommand } from "./meetJozSemantics";

test("allows ascend from vibe and skills in meet-joz", () => {
  expect(resolveMeetJozSemanticCommand("vibe", "discover")).toEqual({
    action: "discover",
    target: null,
    awareness: "Opening Ascend.",
  });

  expect(resolveMeetJozSemanticCommand("skills", "discover")).toEqual({
    action: "discover",
    target: null,
    awareness: "Returning to Ascend.",
  });
});

test("advances flex to ascend from vibe and returns from deeper layers", () => {
  expect(resolveMeetJozSemanticCommand("vibe", "flex")).toEqual({
    action: "discover",
    target: null,
    awareness: "Opening Ascend.",
  });

  expect(resolveMeetJozSemanticCommand("discover", "flex")).toEqual({
    action: "vibe",
    target: null,
    awareness: "Returning to Flex.",
  });

  expect(resolveMeetJozSemanticCommand("skills", "flex")).toEqual({
    action: "vibe",
    target: null,
    awareness: "Returning to Flex.",
  });
});
