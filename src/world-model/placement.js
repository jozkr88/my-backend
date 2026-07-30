const CATALOG = {
  joz_neurons: [
    { id: "signal-reasoning", label: "Signal Reasoning", kind: "neuron" },
    { id: "context-engineering", label: "Context Engineering", kind: "neuron" },
    { id: "decision-loop", label: "Decision Loop", kind: "neuron" },
    { id: "verification", label: "Verification", kind: "neuron" },
  ],
  joz_works: [
    { id: "marketclue", label: "MarketClue", kind: "work" },
    { id: "manulife", label: "Manulife", kind: "work" },
    { id: "mediacorp", label: "Mediacorp", kind: "work" },
    { id: "erste-bank", label: "Erste Bank", kind: "work" },
    { id: "versace-soa", label: "Versace / SOA", kind: "work" },
  ],
  joz_skills: [
    { id: "agentic-ai-architecture", label: "Agentic AI Architecture", kind: "skill" },
    { id: "decision-intelligence", label: "Decision Intelligence", kind: "skill" },
    { id: "context-engineering", label: "Context Engineering", kind: "skill" },
    { id: "spatial-ai", label: "Spatial AI", kind: "skill" },
    { id: "product-engineering", label: "Product Engineering", kind: "skill" },
  ],
};

const SET_LABELS = {
  joz_neurons: "Joz’s neurons",
  joz_works: "Joz’s works",
  joz_skills: "Joz’s skills",
};

function clean(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(value, phrases) {
  return phrases.some((phrase) => value.includes(phrase));
}

function inferContextualEntitySet(context = {}) {
  const portal = clean(context.currentPortal || context.portal || "");
  const path = clean(context.path || (typeof window !== "undefined" ? window.location.pathname : ""));

  if (portal === "maxx" || portal === "the-vibe-energy" || path.includes("/neo/maxx")) {
    return "joz_neurons";
  }

  if (portal === "meet-joz" || path.includes("/neo/meet-joz")) {
    return "joz_skills";
  }

  return null;
}

export function resolvePlacementIntent(input = "", context = {}) {
  const text = clean(input);
  if (!text) return null;

  const experienceSpatially = hasAny(text, [
    "experience spatially",
    "experience this spatially",
    "experience in space",
    "view spatially",
    "view in space",
    "view in your space",
    "view in my space",
    "view around me",
    "show around me",
    "show in my space",
    "show in your space",
    "show in reality",
    "place around me",
    "place in my space",
    "place in reality",
    "open in ar",
    "open ar",
    "launch ar",
    "zobraz v priestore",
    "ukaz v priestore",
    "ukaz okolo mna",
    "zobraz okolo mna",
    "ukaz pri mne",
    "zobraz pri mne",
    "ukaz v realite",
    "zobraz v realite",
    "otvor v ar",
    "spusti ar",
    "zobrazit v prostoru",
    "ukazat v prostoru",
    "ukaz kolem me",
    "zobraz kolem me",
  ]) || (text.includes("experience") && text.includes("spatially"));

  const explicitEntitySet = hasAny(text, [
    "neuron",
    "neurons",
    "neurony",
    "neuronov",
    "neurony",
    "neurotransmitter",
    "neurotransmitery",
    "brain signal",
    "mozog",
  ])
    ? "joz_neurons"
    : hasAny(text, [
      "work of joz",
      "works of joz",
      "joz work",
      "joz works",
      "joz's work",
      "joz's works",
      "portfolio",
      "projects",
      "projekty",
      "pracu joza",
      "prace joza",
      "jozove prace",
    ])
      ? "joz_works"
    : hasAny(text, [
      "skill of joz",
      "skills of joz",
      "joz skill",
      "joz skills",
      "joz's skill",
      "joz's skills",
      "capabilities",
      "schopnosti",
      "zrucnosti",
      "skillsy",
    ]) ||
      (hasAny(text, ["skill", "skills", "schopnosti", "zrucnosti"]) && hasAny(text, ["view", "see", "show", "place", "put", "bring", "experience", "around me", "in space", "spatially", "ukaz", "zobraz", "priestore", "okolo mna"]))
        ? "joz_skills"
        : null;
  const entitySet = explicitEntitySet || (experienceSpatially ? inferContextualEntitySet(context) : null);

  if (!experienceSpatially && (!entitySet || !hasAny(text, ["place", "put", "bring", "show", "view", "display", "see", "ukaz", "zobraz", "otvor"]))) {
    return null;
  }

  if (experienceSpatially && !entitySet) {
    return {
      action: "experience_spatially",
      entitySet: null,
      entityLabel: null,
      targetMode: "ar",
      layout: "radial",
      anchorId: "current_ar_anchor",
      requiresApproval: true,
      sourceText: text,
    };
  }

  const targetMode = experienceSpatially || hasAny(text, ["reality", "real world", "my space", "your space", "around me", "camera", "ar", "realite", "priestore", "okolo mna", "pri mne", "prostoru", "kolem me"])
    ? "ar"
    : "virtual_world";
  const directSpatialView = targetMode === "ar" &&
    hasAny(text, ["view", "see", "show", "ukaz", "zobraz"]) &&
    hasAny(text, ["around me", "in reality", "my space", "your space", "camera", "ar", "realite", "priestore", "okolo mna", "pri mne", "prostoru", "kolem me"]);
  const action = experienceSpatially || directSpatialView
    ? "experience_spatially"
    : hasAny(text, ["place", "put", "bring", "umiestni", "poloz"])
    ? "place_entity_set"
    : "preview_entity_set";

  return {
    action,
    entitySet,
    entityLabel: SET_LABELS[entitySet],
    targetMode,
    layout: "radial",
    anchorId: targetMode === "ar" ? "current_ar_anchor" : "current_world",
    requiresApproval: true,
    sourceText: text,
  };
}

function stableSlots(count) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const radius = count > 4 ? 34 : 29;
    return {
      x: Math.round(50 + Math.cos(angle) * radius),
      y: Math.round(50 + Math.sin(angle) * radius),
      z: 0,
    };
  });
}

export function getPlacementEntities(entitySet) {
  return (CATALOG[entitySet] || []).map((entity) => ({ ...entity }));
}

export function planWorldPlacement({ request, sceneSnapshot = null } = {}) {
  if (!request?.entitySet || !CATALOG[request.entitySet]) return null;

  const entities = getPlacementEntities(request.entitySet);
  const slots = stableSlots(entities.length);
  const scene = sceneSnapshot?.sceneState || {};
  const anchorAvailable = Boolean(sceneSnapshot?.arMetadata?.anchorIds?.length);
  const anchorId = request.targetMode === "ar"
    ? (sceneSnapshot?.arMetadata?.anchorIds?.[0] || (anchorAvailable ? request.anchorId : "current_world"))
    : request.anchorId || "current_world";

  return {
    placementId: `placement-${request.entitySet}-${request.targetMode}`,
    action: request.action || "place_entity_set",
    entitySet: request.entitySet,
    entityLabel: request.entityLabel || SET_LABELS[request.entitySet],
    targetMode: request.targetMode || "virtual_world",
    executionMode: request.targetMode === "ar" && !anchorAvailable
      ? "virtual_world_fallback"
      : request.targetMode || "virtual_world",
    anchorAvailable,
    layout: request.layout || "radial",
    anchorId,
    requiresApproval: request.requiresApproval !== false,
    sceneId: scene?.sceneId || scene?.activePortal || "root",
    instances: entities.map((entity, index) => ({
      instanceId: `${request.entitySet}:${entity.id}`,
      entityId: entity.id,
      label: entity.label,
      kind: entity.kind,
      transform: slots[index],
    })),
  };
}

export function buildPlacementObservedState({ plan, previousState = {} } = {}) {
  const placedIds = plan?.instances?.map((instance) => instance.instanceId) || [];
  return {
    ...previousState,
    currentStateKey: previousState.currentStateKey || previousState.portal || "root",
    portal: previousState.portal || "root",
    worldRevision: `placement:${plan?.placementId || "unknown"}`,
    placedEntityIds: placedIds,
    placedEntityCount: placedIds.length,
    placement: plan
      ? {
          placementId: plan.placementId,
          entitySet: plan.entitySet,
          targetMode: plan.targetMode,
          anchorId: plan.anchorId,
          layout: plan.layout,
          instances: plan.instances,
        }
      : null,
  };
}
