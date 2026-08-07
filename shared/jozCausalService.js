const VALID_MODES = new Set(["disabled", "shadow", "augment", "decision_support"]);

function cleanText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function getCausalServiceBaseUrl(env = process.env) {
  const configured = cleanText(env?.JOZ_CAUSAL_SERVICE_URL);
  if (!configured) return "http://127.0.0.1:8010";
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(configured)
    ? configured
    : `http://${configured}`;
  return withProtocol.replace(/\/$/, "");
}

function getCausalServiceHeaders(env = process.env) {
  const token = cleanText(env?.JOZ_CAUSAL_SERVICE_TOKEN);
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

function getJozCausalMode(env = process.env) {
  const configured = cleanText(env?.JOZ_CAUSAL_MODE).toLowerCase();
  return VALID_MODES.has(configured) ? configured : "disabled";
}

function classifyCausalQuery(query = "") {
  const text = cleanText(query).toLowerCase();
  if (!text) return "unknown";
  if (/\b(would have|if we had|counterfactual|instead)\b/.test(text)) return "counterfactual";
  if (/\b(what would happen if|what if|intervene|change|increase|decrease)\b/.test(text)) return "intervention";
  if (/\b(should we|which action|recommend|decision)\b/.test(text)) return "decision";
  if (/\b(cause|related|pattern|correlat|associated)\w*/.test(text)) return "association";
  return "unknown";
}

function normalizeEvidence(retrievedDocuments = []) {
  return (Array.isArray(retrievedDocuments) ? retrievedDocuments : [])
    .slice(0, 12)
    .map((document) => ({
      title: cleanText(document?.title) || null,
      summary: cleanText(document?.summary) || null,
      source: cleanText(
        document?.metadata?.source_uri ||
          document?.metadata?.sourceUri ||
          document?.metadata?.source_filename ||
          document?.metadata?.slug
      ) || null,
      verification: cleanText(
        document?.metadata?.verification || document?.metadata?.evidence_tier
      ) || null,
    }))
    .filter((document) => document.title || document.source);
}

function buildDisabledResult(query = "") {
  return {
    mode: "disabled",
    status: "disabled",
    queryType: classifyCausalQuery(query),
    claimStatus: "not_requested",
    capabilities: {},
    provenance: [],
  };
}

export function getJozCausalServiceMode(env = process.env) {
  return getJozCausalMode(env);
}

export function classifyJozCausalQuery(query = "") {
  return classifyCausalQuery(query);
}

export async function requestJozCausalAnalysis({
  query = "",
  graphEvidence = null,
  retrievedDocuments = [],
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const mode = getJozCausalMode(env);
  if (mode === "disabled") return buildDisabledResult(query);
  if (typeof fetchImpl !== "function") {
    return {
      ...buildDisabledResult(query),
      mode,
      status: "unavailable",
      error: "fetch_unavailable",
    };
  }

  const baseUrl = getCausalServiceBaseUrl(env);
  const timeoutMs = Math.max(100, Number(env?.JOZ_CAUSAL_SERVICE_TIMEOUT_MS) || 800);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl}/v1/analyze`, {
      method: "POST",
      headers: getCausalServiceHeaders(env),
      body: JSON.stringify({
        query: cleanText(query).slice(0, 2000),
        query_type: classifyCausalQuery(query),
        graph_evidence: graphEvidence || {},
        evidence: normalizeEvidence(retrievedDocuments),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`causal_service_http_${response.status}`);
    }

    const payload = await response.json();
    return {
      ...payload,
      mode,
      queryType: payload.query_type || payload.queryType || classifyCausalQuery(query),
      claimStatus: payload.claim_status || payload.claimStatus || "unknown",
      status: payload.status || "ok",
    };
  } catch (error) {
    return {
      ...buildDisabledResult(query),
      mode,
      status: "unavailable",
      error: String(error?.name === "AbortError" ? "timeout" : error?.message || "causal_service_failed").slice(0, 160),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestJozCausalEffectEstimate({
  request = {},
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const mode = getJozCausalMode(env);
  if (mode === "disabled") return { mode, status: "disabled", operation: "effect_estimation" };
  if (typeof fetchImpl !== "function") {
    return { mode, status: "unavailable", operation: "effect_estimation", error: "fetch_unavailable" };
  }

  const baseUrl = getCausalServiceBaseUrl(env);
  const timeoutMs = Math.max(100, Number(env?.JOZ_CAUSAL_SERVICE_TIMEOUT_MS) || 8000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${baseUrl}/v1/causal/effect`, {
      method: "POST",
      headers: getCausalServiceHeaders(env),
      body: JSON.stringify(request || {}),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`causal_service_http_${response.status}`);
    const payload = await response.json();
    return {
      ...payload,
      mode,
      operation: payload.operation || "effect_estimation",
      status: payload.status || "unknown",
    };
  } catch (error) {
    return {
      mode,
      status: "unavailable",
      operation: "effect_estimation",
      error: String(error?.name === "AbortError" ? "timeout" : error?.message || "causal_effect_failed").slice(0, 160),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestJozCausalCounterfactual({
  request = {},
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const mode = getJozCausalMode(env);
  if (mode === "disabled") return { mode, status: "disabled", operation: "counterfactual" };
  if (typeof fetchImpl !== "function") {
    return { mode, status: "unavailable", operation: "counterfactual", error: "fetch_unavailable" };
  }

  const baseUrl = getCausalServiceBaseUrl(env);
  const timeoutMs = Math.max(100, Number(env?.JOZ_CAUSAL_SERVICE_TIMEOUT_MS) || 8000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${baseUrl}/v1/causal/counterfactual`, {
      method: "POST",
      headers: getCausalServiceHeaders(env),
      body: JSON.stringify(request || {}),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`causal_service_http_${response.status}`);
    const payload = await response.json();
    return {
      ...payload,
      mode,
      operation: payload.operation || "counterfactual",
      status: payload.status || "unknown",
    };
  } catch (error) {
    return {
      mode,
      status: "unavailable",
      operation: "counterfactual",
      error: String(error?.name === "AbortError" ? "timeout" : error?.message || "causal_counterfactual_failed").slice(0, 160),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestJozCausalRefutation({
  request = {},
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const mode = getJozCausalMode(env);
  if (mode === "disabled") return { mode, status: "disabled", operation: "refutation" };
  if (typeof fetchImpl !== "function") {
    return { mode, status: "unavailable", operation: "refutation", error: "fetch_unavailable" };
  }

  const baseUrl = getCausalServiceBaseUrl(env);
  const timeoutMs = Math.max(100, Number(env?.JOZ_CAUSAL_SERVICE_TIMEOUT_MS) || 8000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${baseUrl}/v1/causal/refute`, {
      method: "POST",
      headers: getCausalServiceHeaders(env),
      body: JSON.stringify(request || {}),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`causal_service_http_${response.status}`);
    const payload = await response.json();
    return {
      ...payload,
      mode,
      operation: payload.operation || "refutation",
      status: payload.status || "unknown",
    };
  } catch (error) {
    return {
      mode,
      status: "unavailable",
      operation: "refutation",
      error: String(error?.name === "AbortError" ? "timeout" : error?.message || "causal_refutation_failed").slice(0, 160),
    };
  } finally {
    clearTimeout(timeout);
  }
}
