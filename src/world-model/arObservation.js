// Deliberately disabled boundary for a future native structured AR bridge.
// This does not request permissions, read camera frames, or store imagery.
export function getStructuredArObservation({ supported = null } = {}) {
  return {
    mode: null,
    supported,
    anchorIds: [],
    trackingQuality: null,
    source: "launcher-only-no-anchor-feed",
    captureEnabled: false,
  };
}
