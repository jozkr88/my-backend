const WORKER_TIMEOUT_MS = 15_000;

function workerBaseUrl() {
  const configured = String(process.env.BUSINESS_VALUE_WORKER_URL || "").trim().replace(/\/+$/, "");
  if (!configured) return "";
  if (/^https?:\/\//i.test(configured)) return configured;
  return `http://${configured}`;
}

export function isBusinessValueWorkerConfigured() {
  return Boolean(workerBaseUrl());
}

export async function runBusinessValueWorkerDiagnostic({
  caseId = "anonymous",
  input = "",
  messages = [],
  currentMesh = null,
  evidenceRecords = [],
  reviewApproved = false,
  priorState = null,
} = {}) {
  const baseUrl = workerBaseUrl();
  if (!baseUrl) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${baseUrl}/v1/diagnostics/${encodeURIComponent(caseId || "anonymous")}/run`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.BUSINESS_VALUE_WORKER_TOKEN
            ? { Authorization: `Bearer ${process.env.BUSINESS_VALUE_WORKER_TOKEN}` }
            : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          input,
          messages,
          currentMesh,
          evidenceRecords,
          reviewApproved,
          priorState,
        }),
      }
    );
    if (!response.ok) throw new Error(`worker returned ${response.status}`);
    const payload = await response.json();
    return payload?.state || null;
  } catch (error) {
    console.warn("⚠️ Business Value worker unavailable; using local diagnostic kernel:", error.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
