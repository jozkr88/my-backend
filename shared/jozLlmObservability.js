function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function countWords(value = "") {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function summarizeChecks(checks = []) {
  const hasFail = checks.some((check) => check.status === "fail");
  const hasWarn = checks.some((check) => check.status === "warn");
  if (hasFail) return "fail";
  if (hasWarn) return "warn";
  return "pass";
}

function buildBaseChecks({ route, resolution, trace, retrievedDocuments, reply, latencyMs }) {
  const wordCount = countWords(reply);
  const checks = [
    {
      id: "non_empty_reply",
      status: reply ? "pass" : "fail",
      detail: reply ? "Assistant reply is present." : "Assistant reply is empty.",
    },
    {
      id: "route_alignment",
      status:
        trace?.selectedRoute && route?.selectedRoute && trace.selectedRoute === route.selectedRoute
          ? "pass"
          : "fail",
      detail: `Selected route: ${trace?.selectedRoute || "unknown"}.`,
    },
    {
      id: "deterministic_validation",
      status: trace?.validationPassed === false ? "fail" : "pass",
      detail:
        trace?.validationPassed === false
          ? "A deterministic route-specific validation failed."
          : "Route-specific validation passed.",
    },
    {
      id: "fallback_control",
      status:
        route?.selectedRoute !== "unknown_fallback" && resolution?.fallbackUsed ? "fail" : "pass",
      detail: resolution?.fallbackUsed
        ? "Fallback path was used."
        : "Fallback path was not used.",
    },
    {
      id: "retrieval_context",
      status: (retrievedDocuments?.length || 0) > 0 ? "pass" : "warn",
      detail:
        (retrievedDocuments?.length || 0) > 0
          ? `Retrieved ${retrievedDocuments.length} supporting documents.`
          : "No retrieval documents were attached.",
    },
    {
      id: "latency_budget",
      status: Number.isFinite(latencyMs) && latencyMs <= 4000 ? "pass" : "warn",
      detail: `Latency ${Number.isFinite(latencyMs) ? latencyMs : "unknown"}ms.`,
    },
    {
      id: "word_budget",
      status: wordCount <= 55 ? "pass" : wordCount <= 75 ? "warn" : "fail",
      detail: `Reply length is ${wordCount} words.`,
    },
    {
      id: "answer_class",
      status: trace?.answerClass ? "pass" : "fail",
      detail: `Answer class: ${trace?.answerClass || "missing"}.`,
    },
    {
      id: "confidence_guard",
      status: trace?.confidence === "low" ? "warn" : trace?.confidence ? "pass" : "fail",
      detail: `Confidence: ${trace?.confidence || "missing"}.`,
    },
  ];

  return { checks, wordCount };
}

function verifyBusinessValueDefinition(reply = "") {
  const clean = normalizeText(reply);
  const mentionsDefinition =
    clean.includes("measurable improvement") ||
    clean.includes("business value is") ||
    clean.includes("measurable");
  const mentionsOutcomeAxis =
    /\brevenue\b|\bmargin\b|\bcost\b|\bspeed\b|\brisk\b|\bdecision quality\b/.test(clean);
  const avoidsGenericHirePitch = !clean.startsWith("joz is worth hiring because");

  return [
    {
      id: "definition_clarity",
      status: mentionsDefinition ? "pass" : "fail",
      detail: mentionsDefinition
        ? "Reply defines business value directly."
        : "Reply does not clearly define business value.",
    },
    {
      id: "outcome_axes",
      status: mentionsOutcomeAxis ? "pass" : "warn",
      detail: mentionsOutcomeAxis
        ? "Reply includes measurable business outcome axes."
        : "Reply does not name outcome axes like cost, speed, or revenue.",
    },
    {
      id: "avoids_generic_hire_pitch",
      status: avoidsGenericHirePitch ? "pass" : "fail",
      detail: avoidsGenericHirePitch
        ? "Reply stays on the definition request."
        : "Reply drifted into a generic hire pitch.",
    },
  ];
}

function verifyRouteSpecificReply({ route, reply }) {
  if (route?.selectedRoute === "business_need" && route?.detectedSubIntent === "business_value_definition") {
    return verifyBusinessValueDefinition(reply);
  }

  return [];
}

export function buildJozResponseVerification({
  input = "",
  route = {},
  resolution = {},
  trace = {},
  reply = "",
  retrievedDocuments = [],
  latencyMs = 0,
} = {}) {
  const { checks: baseChecks, wordCount } = buildBaseChecks({
    route,
    resolution,
    trace,
    retrievedDocuments,
    reply,
    latencyMs,
  });
  const routeChecks = verifyRouteSpecificReply({ route, reply, input });
  const checks = [...baseChecks, ...routeChecks];
  const status = summarizeChecks(checks);

  return {
    status,
    summary:
      status === "pass"
        ? "Reply passed deterministic verification."
        : status === "warn"
          ? "Reply passed core checks with warnings."
          : "Reply failed one or more deterministic checks.",
    metrics: {
      latencyMs,
      wordCount,
      retrievedDocumentCount: retrievedDocuments.length,
    },
    citations: retrievedDocuments.slice(0, 5).map((doc) => ({
      title: doc?.title || null,
      category: doc?.category || null,
      slug: doc?.metadata?.slug || null,
      verificationStatus:
        doc?.metadata?.verification_status ||
        doc?.metadata?.verification?.status ||
        null,
    })),
    checks,
  };
}
