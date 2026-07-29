const DEBUG_TEXT_NAME_RE =
  /\b(ai|human|neuron|spatial|capability|flex|ascend|discover|mogg|skills|back|workf|vibe|joz|enter|meet)\b/i;

export function summarizeSceneGraph(
  root,
  { animationNames = [], interactiveHints = [], state = {} } = {}
) {
  if (!root) return null;

  const nodeNames = [];
  const meshNames = [];
  const visibleMeshNames = [];
  const textLikeNames = [];
  const interactiveMeshNames = [];

  root.traverse((object) => {
    if (!object) return;

    if (object.name) {
      nodeNames.push(object.name);
    }

    if (!object.isMesh) return;

    if (object.name) {
      meshNames.push(object.name);

      if (object.visible) {
        visibleMeshNames.push(object.name);
      }

      if (DEBUG_TEXT_NAME_RE.test(object.name)) {
        textLikeNames.push(object.name);
      }

      if (
        interactiveHints.some((hint) => {
          const lower = String(object.name || "").toLowerCase();
          return lower === hint || lower.includes(hint);
        })
      ) {
        interactiveMeshNames.push(object.name);
      }
    }
  });

  return {
    nodeCount: nodeNames.length,
    meshCount: meshNames.length,
    animationNames,
    state,
    allNodeNames: Array.from(new Set(nodeNames)).sort(),
    allMeshNames: Array.from(new Set(meshNames)).sort(),
    visibleMeshNames: Array.from(new Set(visibleMeshNames)).sort(),
    textLikeMeshNames: Array.from(new Set(textLikeNames)).sort(),
    interactiveMeshNames: Array.from(new Set(interactiveMeshNames)).sort(),
  };
}

export function publishPortalSceneDebug(portalKey, componentKey, payload) {
  if (typeof window === "undefined" || !portalKey || !componentKey) return;
  if (process.env.NODE_ENV === "production") return;

  const current = window.__portalSceneDebug || {};
  const portalEntry = current[portalKey] || { components: {} };

  window.__portalSceneDebug = {
    ...current,
    [portalKey]: {
      updatedAt: new Date().toISOString(),
      components: {
        ...portalEntry.components,
        [componentKey]: payload,
      },
    },
  };
}
