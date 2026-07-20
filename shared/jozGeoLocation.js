const DEFAULT_GEOIP_ENDPOINT = "https://ipwho.is/{ip}";
const GEO_LOOKUP_TIMEOUT_MS = 700;
const GEO_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_GEO_CACHE_ENTRIES = 1000;

const geoCache = new Map();

function normalizeIp(value = "") {
  let ip = String(value || "").trim();
  if (!ip) return "";

  if (ip.startsWith("[") && ip.includes("]")) {
    ip = ip.slice(1, ip.indexOf("]"));
  }

  if (ip.startsWith("::ffff:")) {
    ip = ip.slice("::ffff:".length);
  }

  return ip;
}

function isPrivateOrLocalIp(ip = "") {
  const normalized = normalizeIp(ip).toLowerCase();
  if (!normalized) return true;
  if (normalized === "localhost" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:")) {
    return true;
  }

  const octets = normalized.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function cleanText(value, maxLength = 120) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function buildGeoLabel({ city, region, country } = {}) {
  return [city, region, country].filter(Boolean).join(", ") || null;
}

function normalizeGeoResponse(payload = {}, source = "ipwho.is") {
  if (payload?.error || payload?.success === false) return null;

  const countryCode = cleanText(payload.country_code || payload.countryCode, 8)?.toUpperCase() || null;
  const country = cleanText(payload.country_name || payload.country, 120);
  const region = cleanText(payload.region, 120);
  const regionCode = cleanText(payload.region_code || payload.regionCode, 32);
  const city = cleanText(payload.city, 120);
  const timezone = cleanText(
    typeof payload.timezone === "object" ? payload.timezone?.id : payload.timezone,
    80
  );

  if (!countryCode && !country && !region && !city) return null;

  return {
    source,
    accuracy: "approximate",
    label: buildGeoLabel({ city, region, country }),
    countryCode,
    country,
    region,
    regionCode,
    city,
    timezone,
  };
}

function getCachedGeo(ip) {
  const cached = geoCache.get(ip);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    geoCache.delete(ip);
    return undefined;
  }
  return cached.value;
}

function setCachedGeo(ip, value) {
  if (geoCache.size >= MAX_GEO_CACHE_ENTRIES) {
    const oldestKey = geoCache.keys().next().value;
    if (oldestKey) geoCache.delete(oldestKey);
  }
  geoCache.set(ip, { value, expiresAt: Date.now() + GEO_CACHE_TTL_MS });
}

function getGeoEndpoint(ip) {
  const template = String(process.env.JOZ_GEOIP_ENDPOINT || DEFAULT_GEOIP_ENDPOINT).trim();
  return template.replace("{ip}", encodeURIComponent(ip));
}

export async function resolveJozRequestGeo(ip, { fetchImpl = globalThis.fetch } = {}) {
  const normalizedIp = normalizeIp(ip);
  if (!normalizedIp || isPrivateOrLocalIp(normalizedIp) || typeof fetchImpl !== "function") {
    return null;
  }

  const cached = getCachedGeo(normalizedIp);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEO_LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetchImpl(getGeoEndpoint(normalizedIp), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const geo = normalizeGeoResponse(await response.json());
    setCachedGeo(normalizedIp, geo);
    return geo;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function __resetJozGeoCacheForTests() {
  geoCache.clear();
}
