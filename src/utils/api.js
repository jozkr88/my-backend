const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");
const LIVE_API_BASE = "https://my-backend-qxay.onrender.com";

function isLocalDevHost() {
  if (typeof window === "undefined") return false;
  return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

export function getApiBase() {
  const base = (process.env.REACT_APP_API_BASE || "").trim();
  if (base) return trimTrailingSlash(base);

  if (isLocalDevHost()) {
    return "http://127.0.0.1:3001";
  }

  return "";
}

export function getApiBaseCandidates() {
  const explicitBase = trimTrailingSlash(
    (process.env.REACT_APP_API_BASE || "").trim()
  );

  if (isLocalDevHost()) {
    return dedupe([explicitBase, "http://127.0.0.1:3001", LIVE_API_BASE]);
  }

  return dedupe([explicitBase]);
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

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];

    try {
      if (index > 0) {
        console.warn(`⚠️ API fallback -> ${candidate}`);
      }
      return await fetch(candidate, init);
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
