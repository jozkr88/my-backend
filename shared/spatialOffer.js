const DEFAULT_PUBLIC_ORIGIN = "https://meetjoz.com";

const ENTITY_SET_ALIASES = {
  neurons: "joz_neurons",
  "joz-neurons": "joz_neurons",
  joz_neurons: "joz_neurons",
  skills: "joz_skills",
  "joz-skills": "joz_skills",
  joz_skills: "joz_skills",
  works: "joz_works",
  "joz-works": "joz_works",
  work: "joz_works",
  joz_works: "joz_works",
};

const SPATIAL_OFFER_REGISTRY = {
  joz_neurons: {
    entitySet: "joz_neurons",
    routeSlug: "joz-neurons",
    label: "Joz's neurons",
    query: "Joz world model spatial intelligence neurons signal reasoning context engineering verification",
    assets: {
      ios: { format: "usdz", url: "https://meetjoz.com/neurodesign.usdz" },
      android: { format: "glb", url: "https://meetjoz.com/neurovibes.glb" },
      web: { format: "web", url: "/space/joz-neurons" },
    },
    entities: [
      { id: "signal-reasoning", label: "Signal Reasoning", kind: "neuron" },
      { id: "context-engineering", label: "Context Engineering", kind: "neuron" },
      { id: "decision-loop", label: "Decision Loop", kind: "neuron" },
      { id: "verification", label: "Verification", kind: "neuron" },
    ],
  },
  joz_skills: {
    entitySet: "joz_skills",
    routeSlug: "joz-skills",
    label: "Joz's skills",
    query: "Joz skills agentic AI architecture decision intelligence context engineering spatial AI product engineering",
    assets: {
      ios: null,
      android: { format: "glb", url: "https://meetjoz.com/skills.glb" },
      web: { format: "web", url: "/space/joz-skills" },
    },
    entities: [
      { id: "agentic-ai-architecture", label: "Agentic AI Architecture", kind: "skill" },
      { id: "decision-intelligence", label: "Decision Intelligence", kind: "skill" },
      { id: "context-engineering", label: "Context Engineering", kind: "skill" },
      { id: "spatial-ai", label: "Spatial AI", kind: "skill" },
      { id: "product-engineering", label: "Product Engineering", kind: "skill" },
    ],
  },
  joz_works: {
    entitySet: "joz_works",
    routeSlug: "joz-works",
    label: "Joz's works",
    query: "Joz work projects MarketClue Manulife Mediacorp Erste Versace spatial AI outcomes",
    assets: {
      ios: null,
      android: { format: "glb", url: "https://meetjoz.com/workf.glb" },
      web: { format: "web", url: "/space/joz-works" },
    },
    entities: [
      { id: "marketclue", label: "MarketClue", kind: "work" },
      { id: "manulife", label: "Manulife", kind: "work" },
      { id: "mediacorp", label: "Mediacorp", kind: "work" },
      { id: "erste-bank", label: "Erste Bank", kind: "work" },
      { id: "versace-soa", label: "Versace / SOA", kind: "work" },
    ],
  },
};

function clean(value = "") {
  return String(value || "").trim();
}

function normalizePublicOrigin(value = "") {
  const raw = clean(value) || DEFAULT_PUBLIC_ORIGIN;
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) return DEFAULT_PUBLIC_ORIGIN;
    return parsed.origin;
  } catch {
    return DEFAULT_PUBLIC_ORIGIN;
  }
}

export function normalizeSpatialEntitySet(value) {
  return ENTITY_SET_ALIASES[String(value || "").toLowerCase().trim()] || null;
}

export function getSpatialOfferDefinition(value) {
  const entitySet = normalizeSpatialEntitySet(value);
  return entitySet ? SPATIAL_OFFER_REGISTRY[entitySet] || null : null;
}

export function listSpatialOfferDefinitions() {
  return Object.values(SPATIAL_OFFER_REGISTRY).map((definition) => ({ ...definition }));
}

export function buildSpatialLaunchUrl({
  entitySet,
  offerId,
  mode = "ar",
  origin = DEFAULT_PUBLIC_ORIGIN,
} = {}) {
  const definition = getSpatialOfferDefinition(entitySet);
  if (!definition) return null;
  const url = new URL(`/space/${definition.routeSlug}`, normalizePublicOrigin(origin));
  url.searchParams.set("mode", mode === "ar" ? "ar" : "virtual");
  if (offerId) url.searchParams.set("offer", clean(offerId));
  return url.toString();
}

export function buildSpatialAssetManifest({
  entitySet,
  offerId = "",
  mode = "ar",
  origin = DEFAULT_PUBLIC_ORIGIN,
} = {}) {
  const definition = getSpatialOfferDefinition(entitySet);
  if (!definition) return null;
  const launchUrl = buildSpatialLaunchUrl({ entitySet, offerId, mode, origin });
  return {
    entitySet: definition.entitySet,
    label: definition.label,
    routeSlug: definition.routeSlug,
    launchUrl,
    mode: mode === "ar" ? "ar" : "virtual",
    assets: {
      ios: definition.assets.ios,
      android: definition.assets.android,
      web: {
        ...(definition.assets.web || { format: "web" }),
        url: launchUrl,
      },
    },
    entities: definition.entities.map((entity) => ({ ...entity })),
  };
}

export function publicSpatialOffer(record = {}) {
  const manifest = record.assetManifest || record.asset_manifest || {};
  return {
    offerId: record.offerId || record.offer_id || "",
    entitySet: record.entitySet || record.entity_set || manifest.entitySet || "",
    mode: record.mode || manifest.mode || "ar",
    label: manifest.label || "",
    launchUrl: record.launchUrl || manifest.launchUrl || "",
    assets: manifest.assets || {},
    entities: manifest.entities || [],
    graphEvidence: record.graphEvidence || record.graph_evidence || {},
    expiresAt: record.expiresAt || record.expires_at || null,
  };
}

