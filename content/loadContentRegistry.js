import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTENT_DIR = path.resolve(__dirname, "../../data/world/content");

let contentRegistryCache = null;

function normalizePortalKey(portal) {
  const normalized = String(portal || "").toLowerCase().trim();
  if (!normalized) return "root";
  return normalized === "maxx" ? "the-vibe-energy" : normalized;
}

function normalizeMeshKey(mesh) {
  const normalized = String(mesh || "").toLowerCase().trim();
  if (!normalized) return "";
  if (normalized === "enter") return "enter_portal";
  return normalized;
}

export function loadContentRegistry() {
  if (contentRegistryCache) return contentRegistryCache;

  const registry = {};
  if (!fs.existsSync(CONTENT_DIR)) {
    contentRegistryCache = registry;
    return registry;
  }

  for (const filename of fs.readdirSync(CONTENT_DIR)) {
    if (!filename.endsWith(".json")) continue;

    const filePath = path.join(CONTENT_DIR, filename);
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const portalKey = normalizePortalKey(parsed?.portal || filename.replace(/\.json$/i, ""));

    registry[portalKey] = parsed;
  }

  contentRegistryCache = registry;
  return registry;
}

export function getPortalContentDefinition(portal) {
  const portalKey = normalizePortalKey(portal);
  return loadContentRegistry()[portalKey] || null;
}

export function getContentAwareness({
  currentPortal,
  currentMesh,
  currentPhase,
  contentMode,
}) {
  const definition = getPortalContentDefinition(currentPortal);
  if (!definition) return null;

  const objects = Array.isArray(definition.objects) ? definition.objects : [];
  const normalizedMesh = normalizeMeshKey(currentMesh);
  const scenePhases = Array.isArray(definition?.scene?.phases)
    ? definition.scene.phases
    : [];
  const normalizedPhase =
    String(currentPhase || "")
      .toLowerCase()
      .trim() || null;
  const normalizedContentMode =
    String(contentMode || "")
      .toLowerCase()
      .trim() || null;
  const activePhase = normalizedPhase
    ? scenePhases.find(
        (phase) => String(phase?.id || "").toLowerCase().trim() === normalizedPhase
      ) || null
    : null;

  let focalObjects = [];
  if (normalizedMesh === "brain" && normalizePortalKey(currentPortal) === "root") {
    focalObjects = objects.filter(
      (object) => object.mesh === "brain" || object.mesh === "enter_portal"
    );
  } else if (
    normalizePortalKey(currentPortal) === "meet-joz" &&
    normalizedMesh === "skills"
  ) {
    if (normalizedContentMode === "workf") {
      focalObjects = objects.filter((object) => object.mesh === "workf");
    } else if (
      normalizedContentMode === "jkx" ||
      normalizedContentMode === "jkx-d" ||
      normalizedContentMode === "skills_panel"
    ) {
      focalObjects = objects.filter((object) =>
        ["meet_joz_skills_text_panel", "meet_joz_digital_twin_toggle"].includes(
          object.id
        )
      );
    } else {
      focalObjects = objects.filter((object) => object.id === "meet_joz_mogg");
    }
  } else if (normalizedMesh) {
    focalObjects = objects.filter((object) => {
      const aliases = Array.isArray(object.meshAliases) ? object.meshAliases : [];
      return object.mesh === normalizedMesh || aliases.includes(normalizedMesh);
    });
  }

  if (!focalObjects.length) {
    focalObjects = objects.filter((object) => object.interactive).slice(0, 3);
  }

  const focalIds = new Set(focalObjects.map((object) => object.id));
  const supportingObjects = objects.filter((object) => !focalIds.has(object.id));

  return {
    portal: normalizePortalKey(currentPortal),
    title: definition.title || null,
    summary: definition.summary || null,
    scene: definition.scene || null,
    sequence: Array.isArray(definition.sequence) ? definition.sequence : [],
    currentPhase: activePhase,
    currentMesh: normalizedMesh || null,
    contentMode: normalizedContentMode,
    focalObjects,
    supportingObjects,
  };
}
