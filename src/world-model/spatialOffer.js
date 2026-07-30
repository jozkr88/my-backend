import { apiUrl, fetchJson } from "../utils/api";

const ENTITY_SET_ALIASES = {
  neurons: "joz_neurons",
  "joz-neurons": "joz_neurons",
  joz_neurons: "joz_neurons",
  skills: "joz_skills",
  "joz-skills": "joz_skills",
  joz_skills: "joz_skills",
  works: "joz_works",
  "joz-works": "joz_works",
  joz_works: "joz_works",
};

const SPATIAL_ASSETS = {
  joz_neurons: {
    usdz: "https://meetjoz.com/neurodesign.usdz",
    glb: "https://meetjoz.com/neurovibes.glb",
  },
  joz_skills: {
    usdz: "https://meetjoz.com/Joz-Liquid-Glass-3D-CV.usdz",
    glb: "https://meetjoz.com/Joz-Liquid-Glass-3D-CV.glb",
  },
  joz_works: {
    usdz: null,
    glb: "https://meetjoz.com/workf.glb",
  },
};

const SPATIAL_BACKEND_FALLBACK_STATUSES = [404, 405, 500, 502, 503, 504];

export function normalizeSpatialEntitySet(value) {
  return ENTITY_SET_ALIASES[String(value || "").toLowerCase().trim()] || null;
}

export function spatialEntitySlug(entitySet) {
  return normalizeSpatialEntitySet(entitySet)?.replace(/^joz_/, "joz-") || null;
}

export function getSpatialAssetUrls(entitySet) {
  const normalized = normalizeSpatialEntitySet(entitySet);
  return normalized ? SPATIAL_ASSETS[normalized] || null : null;
}

export function getOfferSpatialAssetUrls(offer) {
  if (!offer?.assets) return null;
  return {
    usdz: offer.assets.ios?.url || null,
    glb: offer.assets.android?.url || offer.assets.web?.url || null,
  };
}

export function normalizeSpatialOfferPayload(payload = {}) {
  const offer = payload.offer || payload;
  if (!offer?.offerId) return null;
  return {
    offerId: offer.offerId,
    entitySet: normalizeSpatialEntitySet(offer.entitySet),
    mode: offer.mode || "ar",
    label: offer.label || "",
    launchUrl: offer.launchUrl || "",
    assets: offer.assets || {},
    entities: offer.entities || [],
    graphEvidence: offer.graphEvidence || {},
    expiresAt: offer.expiresAt || null,
    persisted: payload.persisted === true,
    storageMode: payload.mode || "",
  };
}

export async function requestSpatialOffer({
  entitySet = "joz_neurons",
  mode = "ar",
  input = "",
} = {}) {
  const normalized = normalizeSpatialEntitySet(entitySet);
  if (!normalized) return null;
  const payload = await fetchJson(apiUrl("/api/world-model/spatial-offers"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    retryHttpStatuses: SPATIAL_BACKEND_FALLBACK_STATUSES,
    body: JSON.stringify({
      entitySet: normalized,
      mode: mode === "virtual" ? "virtual" : "ar",
      input,
    }),
  });
  return normalizeSpatialOfferPayload(payload);
}

export async function resolveSpatialOffer(offerId) {
  const id = String(offerId || "").trim();
  if (!id) return null;
  const payload = await fetchJson(
    apiUrl(`/api/world-model/spatial-offers/${encodeURIComponent(id)}`),
    {
      retryHttpStatuses: SPATIAL_BACKEND_FALLBACK_STATUSES,
    }
  );
  return normalizeSpatialOfferPayload(payload);
}

export async function requestSemanticSpatialIntent({
  input = "",
  context = {},
} = {}) {
  const text = String(input || "").trim();
  if (!text) return null;
  const payload = await fetchJson(apiUrl("/api/world-model/spatial-intent"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    retryHttpStatuses: SPATIAL_BACKEND_FALLBACK_STATUSES,
    body: JSON.stringify({ input: text, context }),
  });
  if (!payload?.matched || !payload?.placement?.entitySet) return null;
  return {
    action: payload.placement.action || "experience_spatially",
    target: null,
    awareness: payload.placement.action === "experience_spatially"
      ? "I’ll open a safe spatial AI experience."
      : "I’ll prepare a safe spatial placement preview for your confirmation.",
    placement: payload.placement,
    semanticIntent: {
      source: payload.source,
      confidence: payload.confidence,
      modelRuntime: payload.modelRuntime,
    },
  };
}

export function buildSpatialOfferUrl(
  entitySet = "joz_neurons",
  { mode = "ar", offer = "abc123", origin = "https://meetjoz.com" } = {}
) {
  const slug = spatialEntitySlug(entitySet);
  if (!slug) return null;

  const url = new URL(`/space/${slug}`, origin);
  url.searchParams.set("mode", mode === "ar" ? "ar" : "virtual");
  if (offer) url.searchParams.set("offer", String(offer));
  return url.toString();
}
