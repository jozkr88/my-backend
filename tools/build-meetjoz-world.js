import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function resolveExistingPath(candidates) {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

const SOURCE_DIR = resolveExistingPath([
  path.resolve(__dirname, "../../data/meetjoz/world"),
  path.resolve(__dirname, "../data/meetjoz/world"),
]);
const PUBLISHED_DIR = resolveExistingPath([
  path.resolve(__dirname, "../../data/meetjoz/published"),
  path.resolve(__dirname, "../data/meetjoz/published"),
]);
const MANIFEST_PATH = path.join(PUBLISHED_DIR, "meetjoz-world.generated.json");
const REPORT_PATH = path.join(PUBLISHED_DIR, "meetjoz-world-report.json");
const ASSET_SEARCH_DIRS = [
  path.resolve(__dirname, "../../public"),
  path.resolve(__dirname, "../../build"),
  path.resolve(__dirname, "../../src"),
  path.resolve(__dirname, "../.."),
  path.resolve(__dirname, "../public"),
  path.resolve(__dirname, "../build"),
  path.resolve(__dirname, "../src"),
  path.resolve(__dirname, ".."),
];

function readJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, filename), "utf8"));
}

function stableSortById(items) {
  return [...items].sort((a, b) => String(a?.id || "").localeCompare(String(b?.id || "")));
}

function pushIssue(issues, level, code, message, context = {}) {
  issues.push({ level, code, message, ...context });
}

function assertCondition(condition, issues, code, message, context = {}) {
  if (!condition) {
    pushIssue(issues, "error", code, message, context);
  }
}

function collectUniqueIds(datasets, issues) {
  const seen = new Map();

  for (const [kind, items] of Object.entries(datasets)) {
    for (const item of items) {
      if (!item?.id) {
        pushIssue(issues, "error", "missing_id", `Missing id in ${kind}`, { kind, item });
        continue;
      }
      if (seen.has(item.id)) {
        pushIssue(issues, "error", "duplicate_id", `Duplicate id '${item.id}'`, {
          id: item.id,
          firstKind: seen.get(item.id),
          secondKind: kind,
        });
        continue;
      }
      seen.set(item.id, kind);
    }
  }

  return seen;
}

function indexById(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function hasAsset(asset) {
  if (!asset) return true;
  return ASSET_SEARCH_DIRS.some((dir) => fs.existsSync(path.join(dir, asset)));
}

function validateAssetIfPossible(asset, issues, code, message, context = {}) {
  if (!asset) return;
  if (!hasAsset(asset)) {
    pushIssue(issues, "warning", code, message, context);
  }
}

export function loadMeetJozWorldSources() {
  return {
    world: readJson("world.json"),
    portals: readJson("portals.json"),
    objects: readJson("objects.json"),
    sequences: readJson("sequences.json"),
    states: readJson("states.json"),
    actions: readJson("actions.json"),
    deviceBehaviors: readJson("device-behaviors.json"),
    concepts: readJson("concepts.json"),
    relationships: readJson("relationships.json"),
    navigationFaq: readJson("navigation-faq.json"),
  };
}

export function buildMeetJozWorldManifest(sources = loadMeetJozWorldSources()) {
  const issues = [];
  const datasets = {
    portals: sources.portals,
    objects: sources.objects,
    sequences: sources.sequences,
    states: sources.states,
    actions: sources.actions,
    device_behaviors: sources.deviceBehaviors,
    concepts: sources.concepts,
  };

  collectUniqueIds(datasets, issues);

  const portalById = indexById(sources.portals);
  const objectById = indexById(sources.objects);
  const sequenceById = indexById(sources.sequences);
  const stateById = indexById(sources.states);
  const actionById = indexById(sources.actions);
  const conceptById = indexById(sources.concepts);

  assertCondition(
    sources.world?.id === "meetjoz_spatial_world",
    issues,
    "invalid_world_id",
    "world.json must define id 'meetjoz_spatial_world'"
  );

  for (const portalId of sources.world.portal_ids || []) {
    assertCondition(portalById.has(portalId), issues, "missing_portal_ref", `Unknown portal '${portalId}' in world.json`);
  }

  for (const portal of sources.portals) {
    assertCondition(
      !portal.environment_object_id || objectById.has(portal.environment_object_id),
      issues,
      "missing_environment_object",
      `Portal '${portal.id}' references missing environment object '${portal.environment_object_id}'`
    );
    assertCondition(
      !portal.default_sequence_id || sequenceById.has(portal.default_sequence_id),
      issues,
      "missing_default_sequence",
      `Portal '${portal.id}' references missing sequence '${portal.default_sequence_id}'`
    );
    assertCondition(
      !portal.default_focused_object_id || objectById.has(portal.default_focused_object_id),
      issues,
      "missing_default_object",
      `Portal '${portal.id}' references missing object '${portal.default_focused_object_id}'`
    );
  }

  for (const object of sources.objects) {
    assertCondition(portalById.has(object.portal_id), issues, "invalid_object_portal", `Object '${object.id}' references unknown portal '${object.portal_id}'`);
    validateAssetIfPossible(
      object.asset,
      issues,
      "unverified_asset",
      `Object '${object.id}' asset '${object.asset}' could not be verified in this repo layout`,
      { object_id: object.id, asset: object.asset }
    );

    for (const conceptId of object.concept_ids || []) {
      assertCondition(conceptById.has(conceptId), issues, "invalid_concept_ref", `Object '${object.id}' references unknown concept '${conceptId}'`);
    }

    if (object.target_portal_id) {
      assertCondition(portalById.has(object.target_portal_id), issues, "invalid_target_portal", `Object '${object.id}' references unknown target portal '${object.target_portal_id}'`);
    }
  }

  for (const action of sources.actions) {
    if (action.target_portal_id) {
      assertCondition(portalById.has(action.target_portal_id), issues, "invalid_action_portal", `Action '${action.id}' references unknown portal '${action.target_portal_id}'`);
    }
    if (action.target_object_id) {
      assertCondition(objectById.has(action.target_object_id), issues, "invalid_action_object", `Action '${action.id}' references unknown object '${action.target_object_id}'`);
    }
  }

  for (const sequence of sources.sequences) {
    assertCondition(portalById.has(sequence.portal_id), issues, "invalid_sequence_portal", `Sequence '${sequence.id}' references unknown portal '${sequence.portal_id}'`);
    assertCondition(objectById.has(sequence.primary_object_id), issues, "invalid_sequence_object", `Sequence '${sequence.id}' references unknown primary object '${sequence.primary_object_id}'`);

    const stages = (sequence.stage_ids || []).map((id) => stateById.get(id)).filter(Boolean);
    assertCondition(stages.length === (sequence.stage_ids || []).length, issues, "invalid_sequence_stage_ref", `Sequence '${sequence.id}' references one or more missing stages`);

    const orders = stages.map((stage) => stage.order);
    const sorted = [...orders].sort((a, b) => a - b);
    assertCondition(
      JSON.stringify(orders) === JSON.stringify(sorted),
      issues,
      "invalid_stage_order",
      `Sequence '${sequence.id}' stage order is not ascending`
    );
  }

  for (const state of sources.states) {
    assertCondition(portalById.has(state.portal_id), issues, "invalid_state_portal", `State '${state.id}' references unknown portal '${state.portal_id}'`);
    if (state.sequence_id) {
      assertCondition(sequenceById.has(state.sequence_id), issues, "invalid_state_sequence", `State '${state.id}' references unknown sequence '${state.sequence_id}'`);
    }
    if (state.object_id) {
      assertCondition(objectById.has(state.object_id), issues, "invalid_state_object", `State '${state.id}' references unknown object '${state.object_id}'`);
    }
    for (const objectId of state.focused_object_ids || []) {
      assertCondition(objectById.has(objectId), issues, "invalid_state_focused_object", `State '${state.id}' references unknown focused object '${objectId}'`);
    }
    for (const actionId of state.available_action_ids || []) {
      assertCondition(actionById.has(actionId), issues, "invalid_state_action", `State '${state.id}' references unknown action '${actionId}'`);
    }
  }

  for (const behavior of sources.deviceBehaviors) {
    assertCondition(objectById.has(behavior.object_id), issues, "invalid_device_behavior_object", `Device behavior '${behavior.id}' references unknown object '${behavior.object_id}'`);
    assertCondition(["desktop", "mobile", "spatial"].includes(behavior.device_class), issues, "invalid_device_class", `Device behavior '${behavior.id}' has invalid device class '${behavior.device_class}'`);
    assertCondition(
      !behavior.reveals_object_id || objectById.has(behavior.reveals_object_id),
      issues,
      "invalid_device_behavior_reveal",
      `Device behavior '${behavior.id}' references unknown reveal object '${behavior.reveals_object_id}'`
    );
    validateAssetIfPossible(
      behavior.asset,
      issues,
      "unverified_device_behavior_asset",
      `Device behavior '${behavior.id}' asset '${behavior.asset}' could not be verified in this repo layout`,
      { device_behavior_id: behavior.id, asset: behavior.asset }
    );
  }

  const knownRelationshipTargets = new Set([
    ...portalById.keys(),
    ...objectById.keys(),
    ...sequenceById.keys(),
    ...stateById.keys(),
    ...conceptById.keys(),
  ]);

  for (const relationship of sources.relationships) {
    assertCondition(knownRelationshipTargets.has(relationship.source_id), issues, "invalid_relationship_source", `Relationship source '${relationship.source_id}' does not exist`);
    assertCondition(knownRelationshipTargets.has(relationship.target_id), issues, "invalid_relationship_target", `Relationship target '${relationship.target_id}' does not exist`);
  }

  const manifest = {
    generated_at: new Date().toISOString(),
    world: sources.world,
    portals: stableSortById(sources.portals),
    objects: stableSortById(sources.objects),
    sequences: stableSortById(sources.sequences),
    states: stableSortById(sources.states),
    actions: stableSortById(sources.actions),
    device_behaviors: stableSortById(sources.deviceBehaviors),
    concepts: stableSortById(sources.concepts),
    relationships: [...sources.relationships].sort((a, b) => {
      const left = `${a.source_id}:${a.type}:${a.target_id}`;
      const right = `${b.source_id}:${b.type}:${b.target_id}`;
      return left.localeCompare(right);
    }),
    navigation_faq: [...sources.navigationFaq],
    indexes: {
      portal_ids: stableSortById(sources.portals).map((item) => item.id),
      object_ids: stableSortById(sources.objects).map((item) => item.id),
      sequence_ids: stableSortById(sources.sequences).map((item) => item.id),
      state_ids: stableSortById(sources.states).map((item) => item.id),
      action_ids: stableSortById(sources.actions).map((item) => item.id),
    },
  };

  const report = {
    world_id: sources.world.id,
    source_dir: SOURCE_DIR,
    published_manifest: MANIFEST_PATH,
    issues,
    counts: {
      portals: sources.portals.length,
      objects: sources.objects.length,
      sequences: sources.sequences.length,
      states: sources.states.length,
      actions: sources.actions.length,
      device_behaviors: sources.deviceBehaviors.length,
      concepts: sources.concepts.length,
      relationships: sources.relationships.length,
      navigation_faq: sources.navigationFaq.length,
    },
    status: issues.some((issue) => issue.level === "error") ? "failed" : "ok",
  };

  if (report.status !== "ok") {
    const error = new Error("MeetJoz world build failed");
    error.report = report;
    throw error;
  }

  return { manifest, report };
}

export function writeMeetJozWorldBuild({ manifest, report }) {
  fs.mkdirSync(PUBLISHED_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
}

export function runMeetJozWorldBuild() {
  const result = buildMeetJozWorldManifest();
  writeMeetJozWorldBuild(result);
  return result;
}

if (process.argv[1] === __filename) {
  try {
    const { report } = runMeetJozWorldBuild();
    console.log(`Built MeetJoz world manifest with ${report.counts.objects} objects.`);
  } catch (error) {
    console.error(error.report ? JSON.stringify(error.report, null, 2) : error);
    process.exit(1);
  }
}
