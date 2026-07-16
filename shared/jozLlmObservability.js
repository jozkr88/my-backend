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

function resolveWordBudgetStatus(route = {}, wordCount = 0) {
  const subIntent = route?.detectedSubIntent || "";
  const generousArchitectureSubroutes = new Set([
    "financial_intelligence_platform_architecture",
    "safe_architecture_design",
    "scale_fastapi_architecture",
    "verification_architecture",
    "agent_scope_tradeoffs",
    "single_agent_tradeoffs",
    "agentic_architecture_approach",
    "langgraph_temporal_architecture",
  ]);

  if (wordCount <= 55) return "pass";
  if (generousArchitectureSubroutes.has(subIntent)) {
    if (wordCount <= 320) return "warn";
    return "fail";
  }
  if (wordCount <= 140) return "warn";
  return "fail";
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
      status: resolveWordBudgetStatus(route, wordCount),
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

function verifySkillsCapabilitiesOverview(reply = "") {
  const clean = normalizeText(reply);
  const mentionsCoreCapability =
    clean.includes("agentic ai architecture") ||
    clean.includes("decision intelligence") ||
    clean.includes("context engineering") ||
    clean.includes("enterprise product engineering");
  const avoidsInfraOnlyDrift =
    !clean.includes("private subnets") &&
    !clean.includes("firewalls and security groups") &&
    !clean.includes("tls everywhere");

  return [
    {
      id: "skills_core_capability",
      status: mentionsCoreCapability ? "pass" : "fail",
      detail: mentionsCoreCapability
        ? "Reply stays on Joz's core capability layer."
        : "Reply drifted away from Joz's core capability layer.",
    },
    {
      id: "skills_avoids_infra_only_drift",
      status: avoidsInfraOnlyDrift ? "pass" : "fail",
      detail: avoidsInfraOnlyDrift
        ? "Reply did not collapse into unrelated infrastructure snippets."
        : "Reply collapsed into unrelated infrastructure snippets.",
    },
  ];
}

function verifySkillsCollaboration(reply = "") {
  const clean = normalizeText(reply);
  const mentionsTeam =
    clean.includes("team") ||
    clean.includes("teams") ||
    clean.includes("cross-functional") ||
    clean.includes("stakeholder") ||
    clean.includes("leadership");
  const avoidsInfraOnlyDrift =
    !clean.includes("private subnets") &&
    !clean.includes("tls everywhere") &&
    !clean.includes("blue-green deployment");

  return [
    {
      id: "collaboration_team_signal",
      status: mentionsTeam ? "pass" : "fail",
      detail: mentionsTeam
        ? "Reply stays on team and collaboration evidence."
        : "Reply does not stay on team and collaboration evidence.",
    },
    {
      id: "collaboration_avoids_infra_drift",
      status: avoidsInfraOnlyDrift ? "pass" : "fail",
      detail: avoidsInfraOnlyDrift
        ? "Reply did not drift into infrastructure fragments."
        : "Reply drifted into infrastructure fragments.",
    },
  ];
}

function verifyScaleFastApiArchitecture(reply = "") {
  const clean = normalizeText(reply);
  const mentionsScalingPattern =
    clean.includes("load balancer") ||
    clean.includes("stateless fastapi") ||
    clean.includes("queue and workers") ||
    clean.includes("redis") ||
    clean.includes("postgresql");

  return [
    {
      id: "fastapi_scaling_specificity",
      status: mentionsScalingPattern ? "pass" : "fail",
      detail: mentionsScalingPattern
        ? "Reply includes the expected FastAPI scaling architecture elements."
        : "Reply is too generic and missed the FastAPI scaling architecture elements.",
    },
  ];
}

function verifyVerificationArchitecture(reply = "") {
  const clean = normalizeText(reply);
  const mentionsVerificationPattern =
    clean.includes("verification") ||
    clean.includes("reconciliation") ||
    clean.includes("authoritative") ||
    clean.includes("expected delta") ||
    clean.includes("post-trade state");

  return [
    {
      id: "verification_architecture_specificity",
      status: mentionsVerificationPattern ? "pass" : "fail",
      detail: mentionsVerificationPattern
        ? "Reply includes verification and reconciliation architecture details."
        : "Reply is too generic and missed verification architecture details.",
    },
  ];
}

function verifyRouteSpecificReply({ route, reply, trace }) {
  if (
    ["clarification_guard", "scope_boundary", "knowledge_gap", "interaction_guard"].includes(
      trace?.answerClass
    )
  ) {
    return [];
  }

  if (route?.selectedRoute === "business_need" && route?.detectedSubIntent === "business_value_definition") {
    return verifyBusinessValueDefinition(reply);
  }

  if (route?.selectedRoute === "skills" && route?.detectedSubIntent === "capabilities_overview") {
    return verifySkillsCapabilitiesOverview(reply);
  }

  if (route?.selectedRoute === "skills" && route?.detectedSubIntent === "collaboration") {
    return verifySkillsCollaboration(reply);
  }

  if (route?.selectedRoute === "skills" && route?.detectedSubIntent === "scale_fastapi_architecture") {
    return verifyScaleFastApiArchitecture(reply);
  }

  if (route?.selectedRoute === "skills" && route?.detectedSubIntent === "verification_architecture") {
    return verifyVerificationArchitecture(reply);
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
  const routeChecks = verifyRouteSpecificReply({ route, reply, input, trace });
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
