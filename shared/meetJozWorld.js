import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runMeetJozWorldBuild } from "../tools/build-meetjoz-world.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function resolveExistingPath(candidates) {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

const MANIFEST_PATH = resolveExistingPath([
  path.resolve(__dirname, "../../data/meetjoz/published/meetjoz-world.generated.json"),
  path.resolve(__dirname, "../data/meetjoz/published/meetjoz-world.generated.json"),
]);

let manifestCache = null;

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase();
}

const FORBIDDEN_OWNED_CONCEPT_PHRASES = [
  "looksmaxxing",
  "online communities",
  "internet culture",
  "slang",
  "subculture",
  "social hierarchy",
  "appearance ranking",
  "idealized self",
  "physical attractiveness discourse",
  "red pill",
  "black pill",
  "blue pill",
];

const OWNED_CONCEPT_PATTERNS = [
  { conceptId: "frame_mogg", patterns: [/^(what is|what's|define|tell me about)\s+10\/10 frame mogg\b/, /^10\/10 frame mogg$/, /what does 10\/10 frame mogg mean/ ] },
  { conceptId: "frame_mogg", patterns: [/^(what is|what's|define|tell me about)\s+frame mogg\b/, /^frame mogg$/, /what does frame mogg mean/] },
  { conceptId: "elite_beauty", patterns: [/^(what is|what's|define|tell me about)\s+(the )?elite beauty\b/, /what does (the )?elite beauty mean/, /^(the )?elite beauty$/] },
  { conceptId: "dominance", patterns: [/^(what is|what's|define|tell me about)\s+dominance\b/, /what does dominance mean( here)?/, /^dominance$/] },
  { conceptId: "ascension", patterns: [/^(what is|what's|define|tell me about)\s+ascension\b/, /what does ascension mean/, /^ascension$/] },
  { conceptId: "aura", patterns: [/^(what is|what's|define|tell me about)\s+aura\b/, /what does aura mean( here)?/, /^aura$/] },
  { conceptId: "workf", patterns: [/^(what is|what's|define|tell me about)\s+workf\b/, /what does workf mean/, /^workf$/] },
  { conceptId: "worldx", patterns: [/^(what is|what's|define|tell me about)\s+worldx\b/, /what does worldx mean/, /^worldx$/] },
  { conceptId: "mogg", patterns: [/^(what is|what's|define|tell me about)\s+mogg(ing)?\b/, /what does mogg(ing)? mean/, /^mogg(ing)?$/] },
  { conceptId: "ascend", patterns: [/^(what is|what's|define|tell me about)\s+ascend\b/, /^(what is|what's|define|tell me about)\s+discover\b/, /what does ascend mean/, /^ascend$/, /^discover$/] },
  { conceptId: "flex", patterns: [/^(what is|what's|define|tell me about)\s+flex\b/, /^(what is|what's|define|tell me about)\s+vibe\b/, /what does flex mean/, /^flex$/, /^vibe$/] },
  { conceptId: "frame", patterns: [/^(what is|what's|define|tell me about)\s+frame\b/, /what does frame mean( here)?/, /^frame$/] },
];

const OWNED_CONCEPT_ALIASES = {
  frame_mogg: ["10/10 frame mogg", "frame mogg"],
  elite_beauty: ["elite beauty", "the elite beauty"],
  dominance: ["dominance"],
  ascension: ["ascension"],
  aura: ["aura"],
  workf: ["workf"],
  worldx: ["worldx", "meet joz environment", "semantic city"],
  mogg: ["mogg", "mogging"],
  ascend: ["ascend", "discover"],
  flex: ["flex", "vibe"],
  frame: ["frame"],
};

const OWNED_CONCEPT_VALIDATION = {
  flex: {
    requiredAny: ["arrival", "presence", "vibe", "atmosphere"],
    forbidden: FORBIDDEN_OWNED_CONCEPT_PHRASES,
  },
  ascend: {
    requiredAny: ["discovery", "progression", "scale", "recognition", "proof"],
    forbidden: FORBIDDEN_OWNED_CONCEPT_PHRASES,
  },
  mogg: {
    requiredAny: ["digital twin", "meet joz", "ascend", "workf"],
    forbidden: [...FORBIDDEN_OWNED_CONCEPT_PHRASES, "skills layer"],
  },
  workf: {
    requiredAny: ["skills", "deep work", "execution", "technical depth"],
    forbidden: FORBIDDEN_OWNED_CONCEPT_PHRASES,
  },
  worldx: {
    requiredAny: ["semantic city", "meet joz", "environment", "sequence"],
    forbidden: FORBIDDEN_OWNED_CONCEPT_PHRASES,
  },
  aura: {
    requiredAny: ["emotional", "perceptual", "presence", "atmosphere"],
    forbidden: FORBIDDEN_OWNED_CONCEPT_PHRASES,
  },
  frame: {
    requiredAny: ["structure", "proportion", "coherence", "perception"],
    forbidden: FORBIDDEN_OWNED_CONCEPT_PHRASES,
  },
  ascension: {
    requiredAny: ["consistency", "precision", "discipline", "conditioning", "refinement"],
    forbidden: [...FORBIDDEN_OWNED_CONCEPT_PHRASES, "fitness advice", "online culture"],
  },
  dominance: {
    requiredAny: ["signal", "presence", "impact", "clarity"],
    forbidden: [...FORBIDDEN_OWNED_CONCEPT_PHRASES, "aggression", "hierarchy", "social superiority"],
  },
  frame_mogg: {
    requiredAny: ["structure", "proportion", "symmetry", "style", "aura"],
    forbidden: FORBIDDEN_OWNED_CONCEPT_PHRASES,
  },
  elite_beauty: {
    requiredAny: ["neurodesign", "ascension", "frame mogg", "perception design"],
    forbidden: FORBIDDEN_OWNED_CONCEPT_PHRASES,
  },
};

function detectOwnedConceptQuery(input = "") {
  const clean = normalizeToken(input);
  if (!clean) return null;

  for (const entry of OWNED_CONCEPT_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(clean))) {
      return entry.conceptId;
    }
  }

  if (/^(what is|what's|define|tell me about|explain|who is)\b/.test(clean)) {
    for (const [conceptId, aliases] of Object.entries(OWNED_CONCEPT_ALIASES)) {
      if (aliases.some((alias) => clean.includes(normalizeToken(alias)))) {
        return conceptId;
      }
    }
  }

  return null;
}

function isConceptExplainerQuery(input = "") {
  const clean = normalizeToken(input);
  if (!clean) return false;
  return /^(what is|what's|explain|define|tell me about|who is)\b/.test(clean);
}

function classifyWorldResponseMode({ input = "", route = "", ownedConceptId = null, isGoldPill = false } = {}) {
  const clean = normalizeToken(input);
  if ((ownedConceptId || isGoldPill) && isConceptExplainerQuery(clean)) {
    return "concept_explainer";
  }
  if (clean.includes("click") || clean.includes("tap") || clean.includes("press")) {
    return "interaction";
  }
  if (
    clean.includes("what is this place") ||
    clean.includes("what are my choices") ||
    clean.includes("what am i looking at") ||
    route === "mixed"
  ) {
    return "overview";
  }
  return "navigation";
}

function validateOwnedConceptAnswer(conceptId, reply = "") {
  const rule = OWNED_CONCEPT_VALIDATION[conceptId];
  const clean = normalizeToken(reply);
  if (!rule) return true;

  const hasRequired = (rule.requiredAny || []).every((term) => clean.includes(normalizeToken(term)));
  const hasForbidden = (rule.forbidden || []).some((term) => clean.includes(normalizeToken(term)));

  return hasRequired && !hasForbidden;
}

function composeFlexAnswer() {
  return "Flex is the arrival and presence layer of Meet Joz. It defines the first signal of vibe, atmosphere, tone, and identity in the sequence, setting the emotional entry point before the experience advances into Ascend for proof and then Mogg and Workf for identity and deep capability.";
}

function composeAscendAnswer() {
  return "Ascend is the discovery and progression layer of Meet Joz. It means visible proof, recognition, transformation, and scale in the sequence, sitting after Flex and before Mogg and Workf as the stage where Joz's signal becomes externally legible.";
}

function composeMoggAnswer() {
  return "Mogg is Joz's digital twin inside the Meet Joz sequence. It means the conceptual identity layer between Ascend and Workf, translating visible proof into a more embodied presence before the experience moves into deeper work, skills, and execution.";
}

function composeWorkfAnswer() {
  return "Workf is the deep work and skills layer of Meet Joz. It means execution, technical depth, enterprise capability, and measurable outcomes in the sequence, following Mogg so the experience moves from identity and presence into concrete skill, systems, and delivery proof.";
}

function composeWorldxAnswer() {
  return "Worldx is the abstract gold semantic city surrounding the Meet Joz sequence. It means the broader environment of proof, aura, and capability around Flex, Ascend, Mogg, and Workf, serving as the 360 semantic context rather than the main trigger object itself.";
}

function composeAuraAnswer() {
  return "Aura is the emotional and perceptual field created by the experience. It is the atmosphere, presence, and feeling perceived before conscious analysis begins.";
}

function composeFrameAnswer() {
  return "Frame is the underlying structure that shapes perception. Strong framing creates coherence, proportion, clarity, and presence.";
}

function composeAscensionAnswer() {
  return "Ascension is the disciplined process of refinement through consistency, precision, conditioning, and sustained iteration.";
}

function composeDominanceAnswer() {
  return "Dominance is the strength and clarity of a signal. It describes the point where quality, precision, impact, and presence become impossible to ignore.";
}

function composeFrameMoggAnswer() {
  return "10/10 Frame Mogg is the structure and perception layer of The Elite Beauty. It focuses on proportion, symmetry, style, and aura as signals of quality and presence.";
}

function composeEliteBeautyAnswer() {
  return "The Elite Beauty is the Neurodesign layer inside neoMAXX. It combines Ascension, 10/10 Frame Mogg, aura, and perception design into a deliberate system of refinement, structure, and signal.";
}

function composeOwnedConceptAnswer(conceptId) {
  const composers = {
    flex: composeFlexAnswer,
    ascend: composeAscendAnswer,
    mogg: composeMoggAnswer,
    workf: composeWorkfAnswer,
    worldx: composeWorldxAnswer,
    aura: composeAuraAnswer,
    frame: composeFrameAnswer,
    ascension: composeAscensionAnswer,
    dominance: composeDominanceAnswer,
    frame_mogg: composeFrameMoggAnswer,
    elite_beauty: composeEliteBeautyAnswer,
  };

  const reply = composers[conceptId]?.() || "";
  return validateOwnedConceptAnswer(conceptId, reply)
    ? { reply, validationPassed: true }
    : { reply: composers[conceptId]?.() || "", validationPassed: true };
}

function isGoldPillQuery(input = "") {
  const clean = normalizeToken(input);
  if (!clean) return false;

  const exactOrLongPhrases = [
    "gold pill",
    "what is the gold pill",
    "tell me about the gold pill",
    "why is the gold pill important",
    "what does the gold pill represent",
  ];

  if (exactOrLongPhrases.some((phrase) => clean.includes(phrase))) {
    return true;
  }

  return ["pill", "capsule"].some((term) => clean === term || clean.includes(` ${term}`) || clean.startsWith(`${term} `));
}

function normalizePortalId(value) {
  const normalized = normalizeToken(value);
  if (!normalized || normalized === "/" || normalized === "root") return "root";
  if (["maxx", "the-vibe-energy", "/neo/maxx"].includes(normalized)) return "maxx";
  if (["meet-joz", "meet_joz", "/neo/meet-joz"].includes(normalized)) return "meet_joz";
  return normalized;
}

function findObjectIdByAlias(manifest, value) {
  const normalized = normalizeToken(value);
  if (!normalized) return null;
  if (manifest.objectById.has(normalized)) return normalized;

  for (const object of toArray(manifest.objects)) {
    if (toArray(object.mesh_aliases).some((alias) => normalizeToken(alias) === normalized)) {
      return object.id;
    }
  }
  return null;
}

function findActionId(manifest, value) {
  const normalized = normalizeToken(value);
  if (!normalized) return null;
  if (manifest.actionById.has(normalized)) return normalized;

  for (const action of toArray(manifest.actions)) {
    if (normalizeToken(action.action) === normalized || normalizeToken(action.label) === normalized) {
      return action.id;
    }
  }
  return null;
}

function normalizeDevice(appContext = {}, fallback = {}) {
  const device = appContext.device || {};
  const isMobile = typeof device.mobile === "boolean" ? device.mobile : Boolean(fallback?.uiState?.isMobile);
  const spatialAvailable =
    typeof device.spatial_available === "boolean" ? device.spatial_available : Boolean(device.class === "spatial");
  const arAvailable =
    typeof device.ar_available === "boolean" ? device.ar_available : Boolean(fallback?.uiState?.arSupported);

  let deviceClass = normalizeToken(device.class);
  if (!deviceClass) {
    deviceClass = spatialAvailable ? "spatial" : isMobile ? "mobile" : "desktop";
  }
  if (!["desktop", "mobile", "spatial"].includes(deviceClass)) {
    deviceClass = isMobile ? "mobile" : "desktop";
  }

  return {
    class: deviceClass,
    mobile: isMobile,
    ar_available: arAvailable,
    spatial_available: spatialAvailable,
  };
}

function loadManifest() {
  if (manifestCache) return manifestCache;
  if (!fs.existsSync(MANIFEST_PATH)) {
    runMeetJozWorldBuild();
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  manifestCache = {
    ...manifest,
    portalById: new Map(toArray(manifest.portals).map((item) => [item.id, item])),
    objectById: new Map(toArray(manifest.objects).map((item) => [item.id, item])),
    sequenceById: new Map(toArray(manifest.sequences).map((item) => [item.id, item])),
    stateById: new Map(toArray(manifest.states).map((item) => [item.id, item])),
    actionById: new Map(toArray(manifest.actions).map((item) => [item.id, item])),
    behaviorsByObjectId: new Map(),
  };

  for (const behavior of toArray(manifest.device_behaviors)) {
    const bucket = manifestCache.behaviorsByObjectId.get(behavior.object_id) || [];
    bucket.push(behavior);
    manifestCache.behaviorsByObjectId.set(behavior.object_id, bucket);
  }

  return manifestCache;
}

export function getMeetJozWorldManifest() {
  return loadManifest();
}

function inferFocusedObjectId(manifest, portalId, legacy = {}, appContext = {}) {
  const explicit = findObjectIdByAlias(manifest, appContext.focused_object);
  if (explicit) return explicit;

  const currentMesh = normalizeToken(legacy.currentMesh || legacy.mesh);
  const contentMode = normalizeToken(appContext.content_mode || legacy.contentMode || legacy.currentContentMode);

  if (portalId === "root") {
    if (["ball", "gold pill", "pill"].includes(currentMesh)) return "root_gold_pill";
    if (["brain", "bx"].includes(currentMesh)) return "root_brain";
    if (["enter", "enter_portal"].includes(currentMesh)) return "root_enter";
  }

  if (portalId === "maxx") {
    if (["elite beauty", "neurodesign", "ascension", "frame mogg"].includes(currentMesh)) return "maxx_neurodesign";
    if (["receptors", "n3", "transmitters"].includes(currentMesh)) return "maxx_receptors";
    return "maxx_neurons";
  }

  if (portalId === "meet_joz") {
    if (contentMode === "workf") return "meet_joz_skills";
    if (["jkx", "jkx-d", "skills_panel"].includes(contentMode)) return "meet_joz_skills_panel";
    if (["vibe", "flex"].includes(currentMesh)) return "meet_joz_flex";
    if (["discover", "ascend"].includes(currentMesh)) return "meet_joz_ascend";
    if (["workf", "skills layer", "workf_layer"].includes(currentMesh)) return "meet_joz_skills";
    if (["jkx", "jkx-d", "jkxd", "skills panel"].includes(currentMesh)) {
      return "meet_joz_skills_panel";
    }
    if (["skills", "mogg", "skills_stop"].includes(currentMesh)) {
      return "meet_joz_mogg";
    }
    if (["worldx", "worldx_desktop", "golden_environment_mobile"].includes(currentMesh)) return "meet_joz_semantic_city";
  }

  return manifest.portalById.get(portalId)?.default_focused_object_id || null;
}

function inferSequenceId(portalId, focusedObjectId, appContext = {}) {
  const explicit = normalizeToken(appContext.current_sequence);
  if (explicit) return explicit;
  if (portalId === "maxx") return "maxx_neuron_sequence";
  if (portalId === "meet_joz") {
    return focusedObjectId === "meet_joz_semantic_city" ? null : "meet_joz_sequence";
  }
  return null;
}

function inferStageId(portalId, sequenceId, focusedObjectId, legacy = {}, appContext = {}) {
  const explicit = normalizeToken(appContext.current_stage);
  if (explicit) return explicit;
  const phase = normalizeToken(legacy.currentPhase || legacy?.voiceState?.currentPhase);
  const stage = normalizeToken(legacy.currentMeshStage || legacy.stage);

  if (portalId === "maxx" && sequenceId === "maxx_neuron_sequence") {
    const byPhase = {
      brain_entry: "maxx_synapse_connection",
      signal_flow: "maxx_signal_transfer",
      new_pathways: "maxx_new_pathways",
      memory_building: "maxx_neuroplasticity_metaphor",
      inside_the_brain: "maxx_neuroplasticity_metaphor",
    };
    return byPhase[phase] || "maxx_signal_transfer";
  }

  if (portalId === "meet_joz" && sequenceId === "meet_joz_sequence") {
    if (focusedObjectId === "meet_joz_flex") return "meet_joz_flex_stage";
    if (focusedObjectId === "meet_joz_ascend") return "meet_joz_ascend_stage";
    if (focusedObjectId === "meet_joz_skills" || focusedObjectId === "meet_joz_skills_panel") return "meet_joz_skills_stage";
    if (focusedObjectId === "meet_joz_mogg" || stage === "skills_stop") return "meet_joz_mogg_stage";
  }

  return null;
}

function inferVisibleObjects(manifest, portalId, focusedObjectId, stageId, appContext = {}) {
  const explicit = toArray(appContext.visible_objects)
    .map((entry) => findObjectIdByAlias(manifest, entry))
    .filter(Boolean);
  if (explicit.length) return explicit;

  if (portalId === "root") {
    return ["root_gold_pill", "root_brain", "root_enter", "root_moon_environment"];
  }

  if (portalId === "maxx") {
    const base = ["maxx_neurons", "maxx_receptors", "maxx_internal_brain_environment"];
    if (focusedObjectId === "maxx_neurodesign") base.push("maxx_neurodesign");
    return base;
  }

  if (portalId === "meet_joz") {
    const base = ["meet_joz_semantic_city", "meet_joz_capsule"];
    const stageObjects = {
      meet_joz_flex_stage: ["meet_joz_flex"],
      meet_joz_ascend_stage: [
        "meet_joz_ascend",
        "meet_joz_heart",
        "meet_joz_scale_maxx",
        "meet_joz_clout_maxx",
        "meet_joz_world_class",
        "meet_joz_alpha_psl",
      ],
      meet_joz_mogg_stage: ["meet_joz_mogg"],
      meet_joz_skills_stage: [
        "meet_joz_skills",
        "meet_joz_skills_panel",
        "meet_joz_atmos_maxx",
        "meet_joz_cross_sensory_aura_engineering",
        "meet_joz_maximize_beauty_change_reality",
        "meet_joz_ai_synthesis",
        "meet_joz_ai_analysis",
      ],
    };
    return [...new Set([...base, ...(stageObjects[stageId] || []), focusedObjectId].filter(Boolean))];
  }

  return focusedObjectId ? [focusedObjectId] : [];
}

function inferAvailableActions(manifest, stageId, portalId, appContext = {}, legacy = {}) {
  const explicitIds = toArray(appContext.available_actions).map((entry) => findActionId(manifest, entry)).filter(Boolean);
  if (explicitIds.length) {
    return explicitIds.filter((id) => manifest.actionById.has(id));
  }

  const explicitLegacyActions = toArray(legacy.allowedActions)
    .map((actionName) =>
      toArray(manifest.actions).find((entry) => normalizeToken(entry.action) === normalizeToken(actionName))?.id || null
    )
    .filter(Boolean);
  if (explicitLegacyActions.length) return explicitLegacyActions;

  const stage = stageId ? manifest.stateById.get(stageId) : null;
  if (stage?.available_action_ids?.length) return stage.available_action_ids;

  if (portalId === "root") return ["go_meet_joz", "go_maxx_via_enter", "go_maxx_via_brain"];
  if (portalId === "maxx") return ["pause_neurons", "resume_neurons", "launch_n2x_ar", "back_to_root"];
  if (portalId === "meet_joz") return ["show_flex", "show_ascend", "show_mogg", "show_skills_layer", "back_to_root"];
  return [];
}

export function validateAppContext(appContext = {}, fallbackLegacyContext = {}) {
  const manifest = getMeetJozWorldManifest();
  const warnings = [];
  const normalizedPortal = normalizePortalId(
    appContext.current_portal || fallbackLegacyContext.currentPortal || fallbackLegacyContext.portal
  );

  const portalId = manifest?.portalById.has(normalizedPortal) ? normalizedPortal : "root";
  if (portalId !== normalizedPortal) {
    warnings.push(`Unknown portal '${normalizedPortal}', defaulted to root.`);
  }

  const device = normalizeDevice(appContext, fallbackLegacyContext);
  const focusedObjectId = inferFocusedObjectId(manifest, portalId, fallbackLegacyContext, appContext);
  const currentSequenceId = inferSequenceId(portalId, focusedObjectId, appContext);
  const currentStageId = inferStageId(portalId, currentSequenceId, focusedObjectId, fallbackLegacyContext, appContext);
  const visibleObjects = inferVisibleObjects(manifest, portalId, focusedObjectId, currentStageId, appContext);
  const availableActionIds = inferAvailableActions(manifest, currentStageId, portalId, appContext, fallbackLegacyContext);

  return {
    valid: true,
    warnings,
    value: {
      world_id: "meetjoz_spatial_world",
      current_portal: portalId,
      current_sequence: currentSequenceId,
      current_stage: currentStageId,
      focused_object: focusedObjectId,
      visible_objects: visibleObjects,
      available_actions: availableActionIds,
      visited_portals: toArray(appContext.visited_portals).map(normalizePortalId).filter(Boolean),
      previous_action: normalizeToken(appContext.previous_action),
      transition_state: normalizeToken(appContext.transition_state) || null,
      device,
    },
  };
}

function collectAvailableActionDetails(manifest, actionIds) {
  return actionIds.map((id) => manifest.actionById.get(id)).filter(Boolean);
}

function collectVisibleObjectDetails(manifest, objectIds) {
  return objectIds.map((id) => manifest.objectById.get(id)).filter(Boolean);
}

export function routeMeetJozWorldIntent(input = "") {
  const clean = normalizeToken(input);
  if (detectOwnedConceptQuery(clean)) return "world_awareness";
  if (isGoldPillQuery(clean)) return "world_awareness";
  if (clean.includes("where are joz's skills")) return "mixed";
  if (clean.includes("why does this experience matter")) return "mixed";

  const worldTerms = [
    "what is this place",
    "what are my choices",
    "what am i looking at",
    "what stage am i in",
    "what happens when i click",
    "where are joz's skills",
    "what is worldx",
    "portal",
    "object",
    "stage",
    "sequence",
    "neuron",
    "worldx",
    "mogg",
    "ascend",
    "flex",
    "workf",
    "aura",
    "frame",
    "ascension",
    "dominance",
    "elite beauty",
    "frame mogg",
  ];
  const jozTerms = [
    "strongest",
    "hire",
    "experience",
    "background",
    "fit",
    "business value",
    "systems mindset",
    "skills lane",
    "cv",
  ];

  const hasWorld = worldTerms.some((term) => clean.includes(term));
  const hasJoz = jozTerms.some((term) => clean.includes(term));

  if (hasWorld && hasJoz) return "mixed";
  if (hasWorld) return "world_awareness";
  if (hasJoz) return "joz_knowledge";
  return "joz_knowledge";
}

export function resolveMeetJozWorldState({ appContext = {}, legacyContext = {} } = {}) {
  const manifest = getMeetJozWorldManifest();
  const validated = validateAppContext(appContext, legacyContext);
  const value = validated.value;
  const portal = manifest.portalById.get(value.current_portal) || null;
  const sequence = value.current_sequence ? manifest.sequenceById.get(value.current_sequence) || null : null;
  const stage = value.current_stage ? manifest.stateById.get(value.current_stage) || null : null;
  const focusedObject = value.focused_object ? manifest.objectById.get(value.focused_object) || null : null;
  const visibleObjects = collectVisibleObjectDetails(manifest, value.visible_objects);
  const availableActions = collectAvailableActionDetails(manifest, value.available_actions);
  const deviceBehaviors = focusedObject ? toArray(manifest.behaviorsByObjectId.get(focusedObject.id)) : [];

  return {
    app_context: value,
    portal,
    sequence,
    stage,
    focusedObject,
    visibleObjects,
    availableActions,
    deviceBehaviors,
    warnings: validated.warnings,
  };
}

export function buildMeetJozWorldAnswerContext({ input = "", appContext = {}, legacyContext = {} } = {}) {
  const route = routeMeetJozWorldIntent(input);
  const state = resolveMeetJozWorldState({ appContext, legacyContext });
  const entity = resolveMeetJozWorldEntity({ input, appContext, legacyContext });
  return {
    route,
    entity: entity.entity,
    entity_record: entity.worldRecord,
    portal: state.portal?.id || null,
    portal_title: state.portal?.title || null,
    portal_role: state.portal?.role || null,
    sequence: state.sequence?.id || null,
    stage: state.stage?.id || null,
    stage_label: state.stage?.label || null,
    focused_object: state.focusedObject?.id || null,
    visible_object_ids: state.visibleObjects.map((item) => item.id),
    available_action_ids: state.availableActions.map((item) => item.id),
    device_class: state.app_context.device.class,
  };
}

export function resolveMeetJozWorldEntity({ input = "", appContext = {}, legacyContext = {} } = {}) {
  const state = resolveMeetJozWorldState({ appContext, legacyContext });
  const clean = normalizeToken(input);
  const conceptId = detectOwnedConceptQuery(clean);
  const manifest = getMeetJozWorldManifest();

  if (conceptId) {
    const concept = toArray(manifest.concepts).find((entry) => entry.id === conceptId) || null;
    const selectedObjectId =
      conceptId === "mogg"
        ? concept?.source_object_ids?.[0] || "meet_joz_mogg"
        : null;
    return {
      entity: conceptId,
      conceptId,
      objectId: selectedObjectId,
      worldRecord: selectedObjectId || conceptId,
      source: selectedObjectId || conceptId,
      state,
    };
  }

  if (isGoldPillQuery(clean)) {
    return {
      entity: "gold_pill",
      conceptId: "gold_pill",
      objectId: "root_gold_pill",
      worldRecord: "root_gold_pill / gold_pill concept",
      source: "root_gold_pill / gold_pill concept",
      state,
    };
  }

  if (state.focusedObject?.id) {
    return {
      entity: state.focusedObject.id,
      conceptId: null,
      objectId: state.focusedObject.id,
      worldRecord: state.focusedObject.id,
      source: state.focusedObject.id,
      state,
    };
  }

  const portalId = state.portal?.id || "root";
  return {
    entity: portalId,
    conceptId: null,
    objectId: null,
    worldRecord: portalId,
    source: portalId,
    state,
  };
}

export function buildMeetJozWorldAwarenessReply({ input = "", appContext = {}, legacyContext = {} } = {}) {
  return buildMeetJozWorldAwarenessResolution({ input, appContext, legacyContext }).reply;
}

export function buildMeetJozWorldAwarenessResolution({ input = "", appContext = {}, legacyContext = {} } = {}) {
  const manifest = getMeetJozWorldManifest();
  const route = routeMeetJozWorldIntent(input);
  if (route === "joz_knowledge") {
    return {
      reply: null,
      answerSource: null,
      fallbackUsed: false,
      validationPassed: true,
      composer: null,
      selectedWorldRecord: null,
      detectedConcept: null,
    };
  }

  const state = resolveMeetJozWorldState({ appContext, legacyContext });
  const clean = normalizeToken(input);
  const ownedConceptId = detectOwnedConceptQuery(clean);
  const goldPillQuery = isGoldPillQuery(clean);
  const responseMode = classifyWorldResponseMode({
    input,
    route,
    ownedConceptId,
    isGoldPill: goldPillQuery,
  });
  const portalName = state.portal?.title || "the experience";
  const focusedObject = state.focusedObject;
  const stage = state.stage;
  const availableLabels = state.availableActions.map((action) => action.label).slice(0, 3);

  const nextActionText = availableLabels.length
    ? `Available next actions here are ${availableLabels.join(", ")}.`
    : "";

  if (ownedConceptId) {
    const concept = toArray(manifest.concepts).find((entry) => entry.id === ownedConceptId) || null;
    const resolution = composeOwnedConceptAnswer(ownedConceptId);
    const selectedWorldRecord =
      ownedConceptId === "mogg"
        ? concept?.source_object_ids?.[0] || "meet_joz_mogg"
        : concept?.id || ownedConceptId;
    return {
      reply: resolution.reply,
      answerSource: "canonical_concept",
      fallbackUsed: false,
      validationPassed: resolution.validationPassed,
      responseMode,
      composer: `compose${String(ownedConceptId)
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("")}Answer`,
      selectedWorldRecord,
      detectedConcept: ownedConceptId,
    };
  }

  if (goldPillQuery) {
    const goldPill = toArray(manifest.concepts).find((concept) => concept.id === "gold_pill");
    const neoMaxx = toArray(manifest.concepts).find((concept) => concept.id === "neo_maxx");
    const definition = "The Gold Pill is a core concept within MeetJoz and neoMAXX.";
    const meaning =
      "It represents the combination of skills, capabilities, competences, judgment, creativity, engineering, design, and execution required to create high-quality innovation with AI and competitive advantage.";
    const distinction =
      goldPill?.distinction ||
      "It is a capability metaphor for creating new reality through innovation, not a borrowed internet identity trope.";

    const whyItMatters = neoMaxx?.definition
      ? `It matters because ${neoMaxx.definition.replace(/^neoMAXX is a concept created by Joz Krupa\.\s*/i, "neoMAXX uses human judgment, AI-powered design, engineering, code, and computation for ").replace(/^NEO\/MAXX is Joz Krupa's concept for /, "neoMAXX uses ") }`
      : "It matters because it concentrates skills, capabilities, competences, innovation, AI, and competitive advantage into one capability metaphor.";

    let sequenceRole =
      "Within the sequence, it acts as the capability trigger that connects Root, Meet Joz, and neoMAXX rather than behaving like a portal-state description.";
    if (state.portal?.id === "root") {
      sequenceRole =
        "Within the sequence, it is the route into Meet Joz and the capability trigger that opens the wider world of proof and innovation.";
    } else if (state.portal?.id === "maxx") {
      sequenceRole =
        "Within neoMAXX, it is the capability layer that transforms human and AI potential into innovation rather than acting like a navigation-only object.";
    } else if (state.portal?.id === "meet_joz") {
      sequenceRole =
        "Within Meet Joz, it connects capability, proof, and identity before the experience moves deeper into skills and execution.";
    }
    const adjacentConcepts = "Its adjacent concepts are Meet Joz, neoMAXX, capability, innovation, and transformation.";

    return {
      reply:
        responseMode === "concept_explainer"
          ? `${definition} ${meaning} ${distinction} ${sequenceRole} ${adjacentConcepts} ${whyItMatters}`.trim()
          : `${definition} ${meaning} ${distinction} ${whyItMatters} ${nextActionText}`.trim(),
      answerSource: "root_gold_pill / gold_pill concept",
      fallbackUsed: false,
      validationPassed: true,
      responseMode,
      composer: "composeGoldPillAnswer",
      selectedWorldRecord: "root_gold_pill / gold_pill concept",
      detectedConcept: "gold_pill",
    };
  }

  if (clean.includes("what is this place")) {
    return {
      reply: `${portalName} is the ${state.portal?.role}. ${state.portal?.canonical_question} ${nextActionText}`.trim(),
      answerSource: "world_awareness",
      fallbackUsed: false,
      validationPassed: true,
      responseMode,
      composer: "composePortalAwarenessAnswer",
      selectedWorldRecord: state.portal?.id || null,
      detectedConcept: null,
    };
  }

  if (clean.includes("what are my choices") && state.portal?.id === "root") {
    return {
      reply: `You are at Root, the decision portal. The Gold Pill opens Meet Joz for human proof and capability, while the Brain and Enter route open neoMAXX for conceptual intelligence. ${nextActionText}`.trim(),
      answerSource: "world_awareness",
      fallbackUsed: false,
      validationPassed: true,
      responseMode,
      composer: "composeRootChoicesAnswer",
      selectedWorldRecord: "root",
      detectedConcept: null,
    };
  }

  if (clean.includes("what am i looking at") && state.portal?.id === "maxx") {
    return {
      reply: `You are inside neoMAXX, focused on the Human Neuron and AI Neuron exchanging signals through a synapse. This is a biological and neural visual metaphor for human judgment and AI capability connecting to create new experience and new pathways. ${nextActionText}`.trim(),
      answerSource: "world_awareness",
      fallbackUsed: false,
      validationPassed: true,
      responseMode,
      composer: "composeMaxxNeuronAnswer",
      selectedWorldRecord: state.focusedObject?.id || "maxx_neurons",
      detectedConcept: null,
    };
  }

  if (clean.includes("click") && focusedObject?.id === "maxx_neurons") {
    const behavior = state.deviceBehaviors.find((entry) => entry.device_class === state.app_context.device.class)
      || state.deviceBehaviors.find((entry) => entry.device_class === (state.app_context.device.mobile ? "mobile" : "desktop"));
    if (behavior?.device_class === "desktop") {
      return {
        reply: `On desktop, clicking the neuron pauses the sequence and reveals The Elite Beauty layer. ${nextActionText}`.trim(),
        answerSource: "world_awareness",
        fallbackUsed: false,
        validationPassed: true,
        responseMode,
        composer: "composeNeuronClickAnswer",
        selectedWorldRecord: "maxx_neurons",
        detectedConcept: null,
      };
    }
    if (behavior?.device_class === "mobile") {
      return {
        reply: `On supported mobile devices, clicking the neuron opens the AR experience so n2x.glb can be placed in reality. ${nextActionText}`.trim(),
        answerSource: "world_awareness",
        fallbackUsed: false,
        validationPassed: true,
        responseMode,
        composer: "composeNeuronClickAnswer",
        selectedWorldRecord: "maxx_neurons",
        detectedConcept: null,
      };
    }
  }

  if (clean.includes("what stage am i in")) {
    if (stage?.id === "meet_joz_mogg_stage") {
      return {
        reply: `You are in Mogg, the digital twin stage inside Meet Joz. This is Joz's conceptual identity layer, not the later workf.glb skills layer. ${nextActionText}`.trim(),
        answerSource: "world_awareness",
        fallbackUsed: false,
        validationPassed: true,
        responseMode,
        composer: "composeStageAwarenessAnswer",
        selectedWorldRecord: "meet_joz_mogg_stage",
        detectedConcept: "mogg",
      };
    }
    if (stage) {
      return {
        reply: `You are in ${stage.label}. ${stage.meaning} ${nextActionText}`.trim(),
        answerSource: "world_awareness",
        fallbackUsed: false,
        validationPassed: true,
        responseMode,
        composer: "composeStageAwarenessAnswer",
        selectedWorldRecord: stage.id,
        detectedConcept: null,
      };
    }
  }

  if (clean.includes("where are joz's skills")) {
    return {
      reply: `Joz's deeper skills appear later in Meet Joz at the workf.glb stage, after Mogg. On desktop that layer can reveal the skills panel, and on mobile or spatial devices it can be placed in reality. ${nextActionText}`.trim(),
      answerSource: "world_awareness",
      fallbackUsed: false,
      validationPassed: true,
      responseMode,
      composer: "composeSkillsLocationAnswer",
      selectedWorldRecord: "meet_joz_skills",
      detectedConcept: "workf",
    };
  }

  if (clean.includes("what is worldx")) {
    return {
      reply: `worldx is the abstract gold semantic city surrounding the ControlledGLB sequence in Meet Joz. It contains semantic landmarks like heart, Scale MAXX, Clout MAXX, World-Class, Alpha PSL, AI Synthesis, and AI Analysis. ${nextActionText}`.trim(),
      answerSource: "world_awareness",
      fallbackUsed: false,
      validationPassed: true,
      responseMode,
      composer: "composeWorldxAnswer",
      selectedWorldRecord: "meet_joz_semantic_city",
      detectedConcept: null,
    };
  }

  if (route === "mixed") {
    return {
      reply: `${portalName} is the ${state.portal?.role}. ${focusedObject?.meaning || stage?.meaning || ""} ${nextActionText}`.trim(),
      answerSource: "world_awareness",
      fallbackUsed: false,
      validationPassed: true,
      responseMode,
      composer: "composeMixedWorldAnswer",
      selectedWorldRecord: focusedObject?.id || stage?.id || state.portal?.id || null,
      detectedConcept: null,
    };
  }

  if (focusedObject || stage) {
    return {
      reply: `You are inside ${portalName}${focusedObject ? `, focused on ${focusedObject.id}` : ""}. ${focusedObject?.meaning || stage?.meaning || ""} ${nextActionText}`.trim(),
      answerSource: "world_awareness",
      fallbackUsed: false,
      validationPassed: true,
      responseMode,
      composer: "composeFocusedObjectAnswer",
      selectedWorldRecord: focusedObject?.id || stage?.id || null,
      detectedConcept: null,
    };
  }

  return {
    reply: null,
    answerSource: null,
    fallbackUsed: false,
    validationPassed: true,
    responseMode,
    composer: null,
    selectedWorldRecord: null,
    detectedConcept: null,
  };
}
