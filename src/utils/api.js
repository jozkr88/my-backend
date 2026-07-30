const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");
const LIVE_API_BASE = "https://my-backend-qxay.onrender.com";

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

export function getApiBase() {
  const base = (process.env.REACT_APP_API_BASE || "").trim();
  if (base) return trimTrailingSlash(base);

  return LIVE_API_BASE;
}

export function getApiBaseCandidates() {
  const explicitBase = trimTrailingSlash(
    (process.env.REACT_APP_API_BASE || "").trim()
  );

  return dedupe([explicitBase, LIVE_API_BASE]);
}

export function apiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBase();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export function getThinkUrl() {
  const explicitThinkUrl = (process.env.REACT_APP_API_URL || "").trim();
  return explicitThinkUrl || apiUrl("/api/think");
}

function getFallbackCandidates(input) {
  if (typeof input !== "string") {
    return [input];
  }

  if (input.startsWith("/api/")) {
    const bases = getApiBaseCandidates();
    return bases.length ? bases.map((base) => `${base}${input}`) : [input];
  }

  try {
    const parsed = new URL(
      input,
      typeof window !== "undefined" ? window.location.origin : "http://localhost"
    );
    const normalizedPath = `${parsed.pathname}${parsed.search}`;

    if (!normalizedPath.startsWith("/api/")) {
      return [input];
    }

    const bases = getApiBaseCandidates();
    return dedupe([
      input,
      ...bases.map((base) => `${base}${normalizedPath}`),
    ]);
  } catch {
    return [input];
  }
}

function isRetryableFetchError(error) {
  return error instanceof TypeError;
}

export async function apiFetch(input, init) {
  const candidates = getFallbackCandidates(input);
  let lastError = null;
  const retryHttpStatuses = Array.isArray(init?.retryHttpStatuses)
    ? init.retryHttpStatuses
    : [];
  const fetchInit = init && typeof init === "object"
    ? Object.fromEntries(
        Object.entries(init).filter(([key]) => key !== "retryHttpStatuses")
      )
    : init;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];

    try {
      if (index > 0) {
        console.warn(`⚠️ API fallback -> ${candidate}`);
      }
      const response = await fetch(candidate, fetchInit);
      if (
        !response.ok &&
        retryHttpStatuses.includes(response.status) &&
        index < candidates.length - 1
      ) {
        lastError = new Error(`API ${response.status} from ${candidate}`);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (!isRetryableFetchError(error) || index === candidates.length - 1) {
        throw error;
      }
    }
  }

  throw lastError || new Error("API request failed");
}

export async function fetchJson(input, init) {
  const response = await apiFetch(input, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${text.slice(0, 200)}`);
  }

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Expected JSON response, received: ${text.slice(0, 200)}`);
  }
}
