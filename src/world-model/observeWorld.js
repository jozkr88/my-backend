import { isWorldModelShadowEnabled } from "./mode";
import { getStructuredArObservation } from "./arObservation";

const OBSERVATION_SCHEMA_VERSION = "1.0";
const MAX_OBJECTS = 200;

function text(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function id(value) {
  return text(value).toLowerCase();
}

function ids(values, limit = MAX_OBJECTS) {
  return [...new Set((Array.isArray(values) ? values : []).map(id).filter(Boolean))]
    .sort()
    .slice(0, limit);
}

function vector(value) {
  if (!Array.isArray(value) || value.length < 3) return null;
  const result = value.slice(0, 3).map(Number);
  return result.every(Number.isFinite) ? result : null;
}

function transform(value = {}) {
  const position = vector(value.position);
  const rotation = vector(value.rotation);
  const scale = vector(value.scale);
  return position || rotation || scale
    ? {
        ...(position ? { position } : {}),
        ...(rotation ? { rotation } : {}),
        ...(scale ? { scale } : {}),
      }
    : null;
}

function transforms(value) {
  return (Array.isArray(value) ? value : [])
    .map((entry) => ({
      id: id(entry?.id || entry?.objectId || entry?.meshId),
      transform: transform(entry?.transform || entry),
      parentId: id(entry?.parentId || entry?.parent) || null,
    }))
    .filter((entry) => entry.id && entry.transform)
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, MAX_OBJECTS);
}

function relations(value) {
  return (Array.isArray(value) ? value : [])
    .map((entry) => ({
      subject: id(entry?.subject || entry?.from),
      relation: text(entry?.relation || entry?.type, 80).toLowerCase(),
      object: id(entry?.object || entry?.to),
    }))
    .filter((entry) => entry.subject && entry.relation && entry.object)
    .sort((left, right) => `${left.subject}|${left.relation}|${left.object}`
      .localeCompare(`${right.subject}|${right.relation}|${right.object}`));
}

function boundedObservation(input = {}) {
  const scene = input.sceneState || {};
  const observation = {
    schemaVersion: OBSERVATION_SCHEMA_VERSION,
    observationId: text(input.observationId || `browser-${Date.now()}`, 120),
    sessionId: text(input.sessionId, 120) || null,
    traceId: text(input.traceId, 120) || null,
    timestamp: input.timestamp || new Date().toISOString(),
    symbolicState: {
      portal: id(input.symbolicState?.portal) || null,
      stage: id(input.symbolicState?.stage) || null,
      currentStateKey: id(input.symbolicState?.currentStateKey) || null,
      focusedEntityId: id(input.symbolicState?.focusedEntityId) || null,
      availableActionIds: ids(input.symbolicState?.availableActionIds, 60),
    },
    sceneState: {
      sceneId: id(scene.sceneId || scene.id) || null,
      activePortal: id(scene.activePortal || scene.portal) || null,
      activeStage: id(scene.activeStage || scene.stage) || null,
      visibleObjectIds: ids(scene.visibleObjectIds || scene.visibleObjects),
      visibleMeshIds: ids(scene.visibleMeshIds || scene.visibleMeshes),
      focusedEntityId: id(scene.focusedEntityId || scene.focusedEntity) || null,
      objectTransforms: transforms(scene.objectTransforms),
      parentChildRelations: relations(scene.parentChildRelations),
      loadingState: text(scene.loadingState, 60) || null,
      animationState: text(scene.animationState, 80) || null,
    },
    cameraState: input.cameraState || {},
    spatialRelationships: relations(input.spatialRelationships),
    overlays: { activeIds: ids(input.overlays?.activeIds || input.overlays, 40) },
    runtimeStatus: input.runtimeStatus || {},
    arMetadata: input.arMetadata || {},
    missingFields: [...new Set((input.missingFields || []).map((field) => text(field, 120)).filter(Boolean))].sort(),
    uncertainty: input.uncertainty || { overall: null, fields: {} },
    fieldSupport: input.fieldSupport || {},
    sourceVersions: input.sourceVersions || { observation: "structured-scene-v1" },
  };
  observation.payloadBytes = JSON.stringify(observation).length;
  observation.payloadWithinLimit = observation.payloadBytes <= 80_000;
  return observation;
}

export function observeBrowserWorld({ appState = {}, sceneSnapshot = null } = {}) {
  if (!isWorldModelShadowEnabled()) return null;

  const scene = sceneSnapshot?.sceneState || {};
  const camera = sceneSnapshot?.cameraState || {};
  return boundedObservation({
    observationId: `browser-${Date.now()}`,
    symbolicState: {
      portal: appState.currentPortal,
      stage: appState.currentMeshStage,
      currentStateKey: appState.currentMeshStage || appState.currentMesh || appState.currentPortal,
      focusedEntityId: appState.currentMesh,
      availableActionIds: appState.allowedActions,
    },
    sceneState: {
      ...scene,
      activePortal: scene.activePortal || appState.currentPortal,
      activeStage: scene.activeStage || appState.currentMeshStage,
      focusedEntityId: scene.focusedEntityId || appState.currentMesh,
      visibleObjectIds: scene.visibleObjectIds || (appState.currentMesh ? [appState.currentMesh] : []),
      visibleMeshIds: scene.visibleMeshIds || (appState.currentMesh ? [appState.currentMesh] : []),
      animationState: scene.animationState || appState.currentPhase,
    },
    cameraState: camera,
    overlays: sceneSnapshot?.overlays || { activeIds: [] },
    runtimeStatus: {
      ...(sceneSnapshot?.runtimeStatus || {}),
      permittedInteractionChannels: ["voice", "pointer", ...(appState.uiState?.arSupported ? ["ar"] : [])],
      loading: sceneSnapshot?.runtimeStatus?.loading ?? false,
      animating: sceneSnapshot?.runtimeStatus?.animating ?? Boolean(appState.currentPhase),
    },
    arMetadata: sceneSnapshot?.arMetadata || getStructuredArObservation({
      supported: Boolean(appState.uiState?.arSupported),
    }),
    missingFields: [
      ...(sceneSnapshot ? [] : ["cameraState", "sceneState.objectTransforms", "spatialRelationships"]),
      "arMetadata.anchorIds",
    ],
    fieldSupport: {
      sceneState: sceneSnapshot ? "observed" : "derived",
      visibleObjectIds: sceneSnapshot?.sceneState?.visibleObjectIds ? "observed" : "derived",
      objectTransforms: sceneSnapshot?.sceneState?.objectTransforms?.length ? "observed" : "unknown",
      cameraState: sceneSnapshot?.cameraState?.position ? "observed" : "unknown",
      spatialRelationships: sceneSnapshot?.spatialRelationships?.length ? "observed" : "unknown",
      arMetadata: "unknown",
    },
    sourceVersions: {
      renderer: sceneSnapshot?.sourceVersions?.renderer || "react-three-fiber-structured-v1",
      sceneManifest: "meetjoz-runtime-context-v1",
      ar: "launcher-only-no-anchor-feed",
    },
  });
}

function canonicalPortal(value) {
  return id(value).replace("meet_joz", "meet-joz");
}

function setOf(values) {
  return new Set((Array.isArray(values) ? values : []).map(id).filter(Boolean));
}

function compareSets(predicted = [], observed = []) {
  const expected = setOf(predicted);
  const actual = setOf(observed);
  const intersection = [...expected].filter((value) => actual.has(value));
  const missing = [...expected].filter((value) => !actual.has(value));
  const unexpected = [...actual].filter((value) => !expected.has(value));
  const precision = actual.size ? intersection.length / actual.size : expected.size ? 0 : 1;
  const recall = expected.size ? intersection.length / expected.size : actual.size ? 0 : 1;
  return {
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 1,
    missing,
    unexpected,
  };
}

function supported(observation, field) {
  const shortField = field.split(".").pop();
  return !observation?.missingFields?.includes(field) &&
    observation?.fieldSupport?.[field] !== "unknown" &&
    observation?.fieldSupport?.[shortField] !== "unknown";
}

function transformMap(observation) {
  return new Map((observation?.sceneState?.objectTransforms || []).map((entry) => [entry.id, entry.transform]));
}

export function reconcileBrowserWorldObservations(predicted = {}, observed = {}) {
  const differences = [];
  const unknownFields = new Set([
    ...(predicted.missingFields || []),
    ...(observed.missingFields || []),
  ]);
  const predictedPortal = predicted.symbolicState?.portal || predicted.sceneState?.activePortal;
  const observedPortal = observed.symbolicState?.portal || observed.sceneState?.activePortal;
  const predictedStage = predicted.symbolicState?.stage || predicted.sceneState?.activeStage;
  const observedStage = observed.symbolicState?.stage || observed.sceneState?.activeStage;
  if (predictedPortal && observedPortal && canonicalPortal(predictedPortal) !== canonicalPortal(observedPortal)) {
    differences.push({ field: "symbolicState.portal", severity: "error", predicted: predictedPortal, observed: observedPortal });
  }
  if (predictedStage && observedStage && id(predictedStage) !== id(observedStage)) {
    differences.push({ field: "symbolicState.stage", severity: "error", predicted: predictedStage, observed: observedStage });
  }

  const visible = compareSets(predicted.sceneState?.visibleObjectIds, observed.sceneState?.visibleObjectIds);
  if (supported(predicted, "sceneState.visibleObjectIds") && supported(observed, "sceneState.visibleObjectIds") &&
      (visible.missing.length || visible.unexpected.length)) {
    differences.push({ field: "sceneState.visibleObjectIds", severity: "error", ...visible });
  }

  const focusedPredicted = predicted.sceneState?.focusedEntityId;
  const focusedObserved = observed.sceneState?.focusedEntityId;
  if (supported(predicted, "sceneState.focusedEntityId") && supported(observed, "sceneState.focusedEntityId") &&
      focusedPredicted && focusedObserved && id(focusedPredicted) !== id(focusedObserved)) {
    differences.push({ field: "sceneState.focusedEntityId", severity: "error", predicted: focusedPredicted, observed: focusedObserved });
  }

  const overlays = compareSets(predicted.overlays?.activeIds, observed.overlays?.activeIds);
  if (overlays.missing.length || overlays.unexpected.length) {
    differences.push({ field: "overlays.activeIds", severity: "error", ...overlays });
  }

  const predictedTransforms = transformMap(predicted);
  const observedTransforms = transformMap(observed);
  let transformCompared = 0;
  let transformErrorCount = 0;
  for (const [objectId, expected] of predictedTransforms.entries()) {
    const actual = observedTransforms.get(objectId);
    if (!actual) continue;
    for (const field of ["position", "rotation", "scale"]) {
      if (!expected?.[field] || !actual?.[field]) continue;
      transformCompared += 1;
      const error = Math.max(...expected[field].map((value, index) => Math.abs(value - actual[field][index])));
      if (error > 0.02) {
        transformErrorCount += 1;
        differences.push({ field: `sceneState.objectTransforms.${objectId}.${field}`, severity: "error", error, tolerance: 0.02 });
      }
    }
  }
  if (!supported(predicted, "objectTransforms") || !supported(observed, "objectTransforms")) {
    unknownFields.add("sceneState.objectTransforms");
  }

  const criticalMismatchCount = differences.filter((difference) => difference.severity === "error").length;
  return {
    exactMatch: differences.length === 0,
    success: criticalMismatchCount === 0,
    differences,
    unknownFields: [...unknownFields].sort(),
    metrics: {
      comparedFieldCount: 8,
      mismatchCount: differences.length,
      criticalMismatchCount,
      unknownFieldCount: unknownFields.size,
      visibleObjectPrecision: visible.precision,
      visibleObjectRecall: visible.recall,
      visibleObjectF1: visible.f1,
      unexpectedObjectRate: observed.sceneState?.visibleObjectIds?.length
        ? visible.unexpected.length / observed.sceneState.visibleObjectIds.length
        : null,
      missingObjectRate: predicted.sceneState?.visibleObjectIds?.length
        ? visible.missing.length / predicted.sceneState.visibleObjectIds.length
        : null,
      focusedEntityAccuracy: focusedPredicted && focusedObserved
        ? Number(id(focusedPredicted) === id(focusedObserved))
        : null,
      overlayAccuracy: overlays.precision === 1 && overlays.recall === 1 ? 1 : 0,
      transformCompared,
      transformErrorCount,
      unsupportedFieldRate: unknownFields.size / 8,
    },
  };
}
