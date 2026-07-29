export const WORLD_OBSERVATION_SCHEMA_VERSION = "1.0";
export const WORLD_OBSERVATION_SOURCE_VERSION = "structured-scene-v1";
export const WORLD_OBSERVATION_MAX_OBJECTS = 200;
export const WORLD_OBSERVATION_MAX_RELATIONSHIPS = 400;
export const WORLD_OBSERVATION_MAX_BYTES = 80_000;

const TRANSFORM_TOLERANCES = {
  position: 0.02,
  rotation: 0.02,
  scale: 0.02,
};

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function finiteVector(value, length = 3) {
  if (!Array.isArray(value)) return null;
  const vector = value.slice(0, length).map(finiteNumber);
  return vector.length === length && vector.every((item) => item !== null) ? vector : null;
}

function cleanText(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeId(value) {
  return cleanText(value, 160).toLowerCase();
}

function normalizeIds(values, limit = WORLD_OBSERVATION_MAX_OBJECTS) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map(normalizeId)
      .filter(Boolean)
  )].sort().slice(0, limit);
}

function normalizeTransform(transform = {}) {
  const position = finiteVector(transform.position);
  const rotation = finiteVector(transform.rotation);
  const scale = finiteVector(transform.scale);
  if (!position && !rotation && !scale) return null;
  return {
    ...(position ? { position } : {}),
    ...(rotation ? { rotation } : {}),
    ...(scale ? { scale } : {}),
  };
}

function normalizeObjectTransforms(value) {
  const entries = Array.isArray(value)
    ? value
    : Object.entries(value && typeof value === "object" ? value : {})
      .map(([id, transform]) => ({ id, ...transform }));

  return entries
    .map((entry) => ({
      id: normalizeId(entry?.id || entry?.objectId || entry?.meshId),
      transform: normalizeTransform(entry?.transform || entry),
      parentId: normalizeId(entry?.parentId || entry?.parent) || null,
    }))
    .filter((entry) => entry.id && entry.transform)
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, WORLD_OBSERVATION_MAX_OBJECTS);
}

function normalizeRelationships(value) {
  return (Array.isArray(value) ? value : [])
    .map((relationship) => ({
      subject: normalizeId(relationship?.subject || relationship?.from),
      relation: cleanText(relationship?.relation || relationship?.type, 80).toLowerCase(),
      object: normalizeId(relationship?.object || relationship?.to),
      confidence: finiteNumber(relationship?.confidence),
      tolerance: finiteNumber(relationship?.tolerance),
    }))
    .filter((relationship) => relationship.subject && relationship.relation && relationship.object)
    .sort((left, right) => [left.subject, left.relation, left.object].join("|")
      .localeCompare([right.subject, right.relation, right.object].join("|")))
    .slice(0, WORLD_OBSERVATION_MAX_RELATIONSHIPS);
}

function normalizeSupport(value, fallback = "unknown") {
  return ["observed", "derived", "predicted", "unknown"].includes(value) ? value : fallback;
}

function normalizeCameraState(camera = {}) {
  const position = finiteVector(camera.position);
  const direction = finiteVector(camera.direction);
  const projection = camera.projection && typeof camera.projection === "object"
    ? {
        type: cleanText(camera.projection.type, 40) || null,
        fov: finiteNumber(camera.projection.fov),
        aspect: finiteNumber(camera.projection.aspect),
        near: finiteNumber(camera.projection.near),
        far: finiteNumber(camera.projection.far),
      }
    : null;
  return {
    ...(position ? { position } : {}),
    ...(direction ? { direction } : {}),
    ...(projection ? { projection } : {}),
    viewport: camera.viewport && typeof camera.viewport === "object"
      ? {
          width: finiteNumber(camera.viewport.width),
          height: finiteNumber(camera.viewport.height),
          pixelRatio: finiteNumber(camera.viewport.pixelRatio),
        }
      : null,
  };
}

function normalizeSceneState(scene = {}) {
  return {
    sceneId: normalizeId(scene.sceneId || scene.id) || null,
    activePortal: normalizeId(scene.activePortal || scene.portal) || null,
    activeStage: normalizeId(scene.activeStage || scene.stage) || null,
    visibleObjectIds: normalizeIds(scene.visibleObjectIds || scene.visibleObjects),
    visibleMeshIds: normalizeIds(scene.visibleMeshIds || scene.visibleMeshes),
    focusedEntityId: normalizeId(scene.focusedEntityId || scene.focusedEntity) || null,
    objectTransforms: normalizeObjectTransforms(scene.objectTransforms),
    parentChildRelations: normalizeRelationships(scene.parentChildRelations),
    loadingState: cleanText(scene.loadingState, 60) || null,
    animationState: cleanText(scene.animationState, 80) || null,
  };
}

function normalizeOverlays(overlays = {}) {
  if (Array.isArray(overlays)) return { activeIds: normalizeIds(overlays, 40), metadata: {} };
  return {
    activeIds: normalizeIds(overlays.activeIds || overlays.activeOverlays, 40),
    metadata: overlays.metadata && typeof overlays.metadata === "object" ? {} : {},
  };
}

function normalizeRuntimeStatus(runtimeStatus = {}) {
  return {
    renderer: cleanText(runtimeStatus.renderer, 80) || null,
    viewportWidth: finiteNumber(runtimeStatus.viewportWidth),
    viewportHeight: finiteNumber(runtimeStatus.viewportHeight),
    loading: typeof runtimeStatus.loading === "boolean" ? runtimeStatus.loading : null,
    animating: typeof runtimeStatus.animating === "boolean" ? runtimeStatus.animating : null,
    permittedInteractionChannels: normalizeIds(runtimeStatus.permittedInteractionChannels, 20),
  };
}

function normalizeArMetadata(ar = {}) {
  return {
    mode: cleanText(ar.mode, 40) || null,
    supported: typeof ar.supported === "boolean" ? ar.supported : null,
    anchorIds: normalizeIds(ar.anchorIds, 40),
    trackingQuality: cleanText(ar.trackingQuality, 40) || null,
    source: cleanText(ar.source, 80) || null,
  };
}

function normalizeUncertainty(uncertainty = {}) {
  return {
    overall: finiteNumber(uncertainty.overall),
    fields: uncertainty.fields && typeof uncertainty.fields === "object"
      ? Object.fromEntries(Object.entries(uncertainty.fields)
          .slice(0, 40)
          .map(([field, value]) => [cleanText(field, 80), finiteNumber(value)]))
      : {},
  };
}

function estimatePayloadBytes(value) {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function buildWorldObservation({
  observationId,
  sessionId = null,
  traceId = null,
  timestamp = new Date().toISOString(),
  symbolicState = {},
  sceneState = {},
  cameraState = {},
  spatialRelationships = [],
  overlays = {},
  runtimeStatus = {},
  arMetadata = {},
  missingFields = [],
  uncertainty = {},
  fieldSupport = {},
  sourceVersions = {},
  predicted = false,
} = {}) {
  const observation = {
    schemaVersion: WORLD_OBSERVATION_SCHEMA_VERSION,
    observationId: cleanText(observationId, 120),
    sessionId: cleanText(sessionId, 120) || null,
    traceId: cleanText(traceId, 120) || null,
    timestamp,
    symbolicState: {
      portal: normalizeId(symbolicState.portal) || null,
      stage: normalizeId(symbolicState.stage) || null,
      currentStateKey: normalizeId(symbolicState.currentStateKey) || null,
      focusedEntityId: normalizeId(symbolicState.focusedEntityId) || null,
      availableActionIds: normalizeIds(symbolicState.availableActionIds, 60),
    },
    sceneState: normalizeSceneState(sceneState),
    cameraState: normalizeCameraState(cameraState),
    spatialRelationships: normalizeRelationships(spatialRelationships),
    overlays: normalizeOverlays(overlays),
    runtimeStatus: normalizeRuntimeStatus(runtimeStatus),
    arMetadata: normalizeArMetadata(arMetadata),
    missingFields: [...new Set(
      (Array.isArray(missingFields) ? missingFields : [])
        .map((field) => cleanText(field, 120))
        .filter(Boolean)
    )].sort().slice(0, 60),
    uncertainty: normalizeUncertainty(uncertainty),
    fieldSupport: Object.fromEntries(Object.entries(fieldSupport || {})
      .slice(0, 80)
      .map(([field, support]) => [cleanText(field, 100), normalizeSupport(support)])),
    sourceVersions: {
      observation: cleanText(sourceVersions.observation || WORLD_OBSERVATION_SOURCE_VERSION, 100),
      renderer: cleanText(sourceVersions.renderer, 100) || null,
      sceneManifest: cleanText(sourceVersions.sceneManifest, 100) || null,
      ar: cleanText(sourceVersions.ar, 100) || null,
    },
    predicted: Boolean(predicted),
  };

  observation.payloadBytes = estimatePayloadBytes(observation);
  observation.payloadWithinLimit = observation.payloadBytes <= WORLD_OBSERVATION_MAX_BYTES;
  return observation;
}

export function observeWorld(context = {}) {
  return buildWorldObservation({
    observationId: context.observationId || `observation-${Date.now()}`,
    sessionId: context.sessionId,
    traceId: context.traceId,
    timestamp: context.timestamp || new Date().toISOString(),
    symbolicState: context.symbolicState || context.appState || {},
    sceneState: context.sceneState || context.scene || {},
    cameraState: context.cameraState || context.camera || {},
    spatialRelationships: context.spatialRelationships,
    overlays: context.overlays || context.appState?.uiState?.activeOverlays,
    runtimeStatus: context.runtimeStatus,
    arMetadata: context.arMetadata,
    missingFields: context.missingFields,
    uncertainty: context.uncertainty,
    fieldSupport: context.fieldSupport,
    sourceVersions: context.sourceVersions,
  });
}

function samePortal(left, right) {
  return normalizeId(left).replace("meet_joz", "meet-joz") ===
    normalizeId(right).replace("meet_joz", "meet-joz");
}

export function predictObservation(currentObservation = {}, action, predictedState = {}, context = {}) {
  const currentScene = currentObservation.sceneState || {};
  const targetPortal = predictedState.portal || currentScene.activePortal;
  const sameScene = samePortal(targetPortal, currentScene.activePortal);
  const manifest = context.portalSceneManifest?.[targetPortal] || null;
  const missingFields = [];

  let visibleObjectIds = [];
  let visibleMeshIds = [];
  let objectTransforms = [];
  let relationships = [];
  let sceneSupport = "unknown";
  if (manifest) {
    visibleObjectIds = manifest.visibleObjectIds || manifest.visibleObjects || [];
    visibleMeshIds = manifest.visibleMeshIds || manifest.visibleMeshes || [];
    objectTransforms = manifest.objectTransforms || [];
    relationships = manifest.spatialRelationships || [];
    sceneSupport = "derived";
  } else if (sameScene) {
    visibleObjectIds = currentScene.visibleObjectIds;
    visibleMeshIds = currentScene.visibleMeshIds;
    objectTransforms = currentScene.objectTransforms;
    relationships = currentObservation.spatialRelationships;
    sceneSupport = currentObservation.fieldSupport?.visibleObjectIds || "observed";
  } else {
    missingFields.push("sceneState.visibleObjectIds", "sceneState.visibleMeshIds", "sceneState.objectTransforms");
  }

  const predicted = observeWorld({
    observationId: context.observationId || `prediction-${Date.now()}`,
    sessionId: context.sessionId,
    traceId: context.traceId,
    timestamp: context.timestamp,
    symbolicState: predictedState,
    sceneState: {
      sceneId: manifest?.sceneId || currentScene.sceneId || targetPortal,
      activePortal: targetPortal,
      activeStage: predictedState.stage,
      visibleObjectIds,
      visibleMeshIds,
      focusedEntityId: predictedState.focusedEntityId || currentScene.focusedEntityId,
      objectTransforms,
      parentChildRelations: manifest?.parentChildRelations || currentScene.parentChildRelations,
      loadingState: manifest?.loadingState || (sameScene ? currentScene.loadingState : null),
      animationState: manifest?.animationState || (sameScene ? currentScene.animationState : null),
    },
    cameraState: context.cameraState || (sameScene ? currentObservation.cameraState : {}),
    spatialRelationships: relationships,
    overlays: { activeIds: predictedState.environment?.activeOverlays || [] },
    runtimeStatus: context.runtimeStatus || (sameScene ? currentObservation.runtimeStatus : {}),
    arMetadata: context.arMetadata || (sameScene ? currentObservation.arMetadata : {}),
    missingFields: [
      ...missingFields,
      ...(sameScene ? [] : ["cameraState", "spatialRelationships"]),
    ],
    uncertainty: {
      overall: sceneSupport === "unknown" ? 0.8 : 0.25,
      fields: {
        visibleObjectIds: sceneSupport === "unknown" ? 1 : 0.25,
        objectTransforms: sceneSupport === "unknown" ? 1 : 0.5,
      },
    },
    fieldSupport: {
      visibleObjectIds: sceneSupport,
      visibleMeshIds: sceneSupport,
      objectTransforms: objectTransforms.length ? sceneSupport : "unknown",
      cameraState: sameScene ? "observed" : "unknown",
      spatialRelationships: relationships.length ? sceneSupport : "unknown",
      arMetadata: "unknown",
    },
    sourceVersions: context.sourceVersions,
  });

  return {
    action: typeof action === "string" ? action : action?.type || action?.action || null,
    predictedObservation: predicted,
    expectedEffects: context.expectedEffects || [],
    successProbability: Number.isFinite(Number(context.successProbability))
      ? Math.max(0, Math.min(1, Number(context.successProbability)))
      : null,
    confidence: Number.isFinite(Number(context.confidence))
      ? Math.max(0, Math.min(1, Number(context.confidence)))
      : null,
    uncertainty: predicted.uncertainty,
    evidenceSources: ["symbolic_transition", ...(manifest ? ["scene_manifest"] : []), ...(context.evidenceSources || [])],
    unsupportedFields: predicted.missingFields,
  };
}

function setOf(values) {
  return new Set((Array.isArray(values) ? values : []).map(normalizeId).filter(Boolean));
}

function compareIdSets(predicted = [], observed = []) {
  const predictedSet = setOf(predicted);
  const observedSet = setOf(observed);
  const intersection = [...predictedSet].filter((id) => observedSet.has(id));
  const missing = [...predictedSet].filter((id) => !observedSet.has(id)).sort();
  const unexpected = [...observedSet].filter((id) => !predictedSet.has(id)).sort();
  const precision = observedSet.size ? intersection.length / observedSet.size : predictedSet.size ? 0 : 1;
  const recall = predictedSet.size ? intersection.length / predictedSet.size : observedSet.size ? 0 : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 1;
  return { precision, recall, f1, missing, unexpected };
}

function transformError(predicted, observed) {
  const errors = {};
  for (const field of ["position", "rotation", "scale"]) {
    if (!predicted?.[field] || !observed?.[field]) continue;
    errors[field] = Math.max(...predicted[field].map((value, index) =>
      Math.abs(Number(value) - Number(observed[field][index]))));
  }
  return errors;
}

function transformWithinTolerance(errors) {
  return Object.entries(errors).every(([field, value]) => value <= TRANSFORM_TOLERANCES[field]);
}

function transformMap(observation) {
  return new Map((observation?.sceneState?.objectTransforms || [])
    .map((entry) => [entry.id, entry.transform]));
}

function relationshipKey(relationship) {
  return [relationship.subject, relationship.relation, relationship.object].join("|");
}

function fieldSupported(observation, field) {
  const shortField = field.split(".").pop();
  return !observation?.missingFields?.includes(field) &&
    observation?.fieldSupport?.[field] !== "unknown" &&
    observation?.fieldSupport?.[shortField] !== "unknown";
}

export function reconcileWorldObservations(predictedObservation = {}, observedObservation = {}) {
  const differences = [];
  const unknownFields = new Set([
    ...(predictedObservation.missingFields || []),
    ...(observedObservation.missingFields || []),
  ]);
  const addDifference = (field, severity, predicted, observed, details = {}) => {
    differences.push({ field, severity, predicted, observed, ...details });
  };

  for (const field of ["portal", "stage"]) {
    const predicted = predictedObservation.symbolicState?.[field] || predictedObservation.sceneState?.[`active${field[0].toUpperCase()}${field.slice(1)}`];
    const observed = observedObservation.symbolicState?.[field] || observedObservation.sceneState?.[`active${field[0].toUpperCase()}${field.slice(1)}`];
    if (predicted == null || observed == null) {
      unknownFields.add(`symbolicState.${field}`);
    } else if (field === "portal" ? !samePortal(predicted, observed) : normalizeId(predicted) !== normalizeId(observed)) {
      addDifference(`symbolicState.${field}`, "error", predicted, observed);
    }
  }

  const predictedVisible = predictedObservation.sceneState?.visibleObjectIds;
  const observedVisible = observedObservation.sceneState?.visibleObjectIds;
  const visible = compareIdSets(predictedVisible, observedVisible);
  const visibleSupported = fieldSupported(predictedObservation, "sceneState.visibleObjectIds") &&
    fieldSupported(observedObservation, "sceneState.visibleObjectIds");
  if (visibleSupported && predictedVisible && observedVisible) {
    if (visible.missing.length || visible.unexpected.length) {
      addDifference("sceneState.visibleObjectIds", "error", predictedVisible, observedVisible, visible);
    }
  } else unknownFields.add("sceneState.visibleObjectIds");

  const focusedPredicted = predictedObservation.sceneState?.focusedEntityId;
  const focusedObserved = observedObservation.sceneState?.focusedEntityId;
  const focusedSupported = fieldSupported(predictedObservation, "sceneState.focusedEntityId") &&
    fieldSupported(observedObservation, "sceneState.focusedEntityId");
  if (focusedSupported && focusedPredicted && focusedObserved && normalizeId(focusedPredicted) !== normalizeId(focusedObserved)) {
    addDifference("sceneState.focusedEntityId", "error", focusedPredicted, focusedObserved);
  } else if (!focusedSupported || !focusedPredicted || !focusedObserved) unknownFields.add("sceneState.focusedEntityId");

  const overlay = compareIdSets(
    predictedObservation.overlays?.activeIds,
    observedObservation.overlays?.activeIds,
  );
  if (overlay.missing.length || overlay.unexpected.length) {
    addDifference("overlays.activeIds", "error", predictedObservation.overlays?.activeIds, observedObservation.overlays?.activeIds, overlay);
  }

  const predictedTransforms = transformMap(predictedObservation);
  const observedTransforms = transformMap(observedObservation);
  const transformMetrics = { compared: 0, withinTolerance: 0, errors: [] };
  for (const [id, predicted] of predictedTransforms.entries()) {
    const observed = observedTransforms.get(id);
    if (!observed) {
      unknownFields.add(`sceneState.objectTransforms.${id}`);
      continue;
    }
    const errors = transformError(predicted, observed);
    transformMetrics.compared += Object.keys(errors).length;
    if (transformWithinTolerance(errors)) transformMetrics.withinTolerance += Object.keys(errors).length;
    else {
      transformMetrics.errors.push({ id, errors, tolerances: TRANSFORM_TOLERANCES });
      addDifference(`sceneState.objectTransforms.${id}`, "error", predicted, observed, { errors });
    }
  }
  if (!fieldSupported(predictedObservation, "objectTransforms") ||
      !fieldSupported(observedObservation, "objectTransforms") ||
      !predictedTransforms.size || !observedTransforms.size) {
    unknownFields.add("sceneState.objectTransforms");
  }

  const predictedRelationships = setOf((predictedObservation.spatialRelationships || []).map(relationshipKey));
  const observedRelationships = setOf((observedObservation.spatialRelationships || []).map(relationshipKey));
  const relationships = compareIdSets([...predictedRelationships], [...observedRelationships]);
  const relationshipsSupported = fieldSupported(predictedObservation, "spatialRelationships") &&
    fieldSupported(observedObservation, "spatialRelationships");
  if (relationshipsSupported && (relationships.missing.length || relationships.unexpected.length)) {
    addDifference("spatialRelationships", "acceptable_difference", predictedRelationships, observedRelationships, relationships);
  } else if (!relationshipsSupported || !predictedRelationships.size || !observedRelationships.size) unknownFields.add("spatialRelationships");

  const criticalMismatchCount = differences.filter((difference) => difference.severity === "error").length;
  const acceptableDifferenceCount = differences.filter((difference) => difference.severity === "acceptable_difference").length;
  return {
    exactMatch: differences.length === 0,
    success: criticalMismatchCount === 0,
    differences,
    unknownFields: [...unknownFields].sort(),
    metrics: {
      comparedFieldCount: 8,
      mismatchCount: differences.length,
      criticalMismatchCount,
      acceptableDifferenceCount,
      unknownFieldCount: unknownFields.size,
      visibleObjectPrecision: visible.precision,
      visibleObjectRecall: visible.recall,
      visibleObjectF1: visible.f1,
      unexpectedObjectRate: observedVisible?.length ? visible.unexpected.length / observedVisible.length : null,
      missingObjectRate: predictedVisible?.length ? visible.missing.length / predictedVisible.length : null,
      focusedEntityAccuracy: focusedPredicted && focusedObserved
        ? Number(normalizeId(focusedPredicted) === normalizeId(focusedObserved))
        : null,
      overlayAccuracy: overlay.precision === 1 && overlay.recall === 1 ? 1 : 0,
      transformCompared: transformMetrics.compared,
      transformWithinTolerance: transformMetrics.withinTolerance,
      transformErrorCount: transformMetrics.errors.length,
      spatialRelationshipAccuracy: relationships.f1,
      unsupportedFieldRate: unknownFields.size / 8,
    },
    tolerances: TRANSFORM_TOLERANCES,
  };
}
