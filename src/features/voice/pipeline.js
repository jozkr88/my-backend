export async function resolveVoicePipeline({
  rawInput,
  isMobile,
  currentPortal,
  currentMesh,
  currentMeshStage,
  context,
  detectImmediateMobileCommand,
  resolveLocalVoiceCommand,
  fetchJson,
  apiUrl,
}) {
  const rawLower = String(rawInput || "").trim().toLowerCase();
  const mobileShortcut = isMobile ? detectImmediateMobileCommand(rawLower) : null;
  const spoken = mobileShortcut || rawLower;

  if (!spoken) {
    return {
      rawLower,
      mobileShortcut,
      spoken: "",
      source: null,
      result: null,
      backendMode: null,
    };
  }

  const localResult = resolveLocalVoiceCommand(
    spoken,
    currentPortal,
    currentMesh,
    currentMeshStage
  );

  if (localResult) {
    return {
      rawLower,
      mobileShortcut,
      spoken,
      source: "local",
      result: localResult,
      backendMode: null,
    };
  }

  const agenticResult = await fetchJson(apiUrl("/api/agentic"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: spoken,
      context,
    }),
  });

  const agenticParams = agenticResult?.params || {};
  const hasAgenticAction =
    Boolean(agenticParams.action) ||
    Boolean(agenticParams.target) ||
    Boolean(agenticParams.awareness);

  if (hasAgenticAction) {
    return {
      rawLower,
      mobileShortcut,
      spoken,
      source: "backend",
      backendMode: "agentic",
      result: {
        action: agenticParams.action || null,
        target: agenticParams.target || null,
        awareness: agenticParams.awareness || agenticResult?.response || null,
        source: agenticParams.source || "agentic",
      },
    };
  }

  const thinkResult = await fetchJson(apiUrl("/api/think"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: spoken,
      currentPortal,
      currentMesh,
      currentMeshStage,
      agentContext: context,
    }),
  });

  return {
    rawLower,
    mobileShortcut,
    spoken,
    source: "backend",
    backendMode: "think_fallback",
    result: {
      action: thinkResult?.action || null,
      target: thinkResult?.target || null,
      awareness: thinkResult?.awareness || null,
      timing: thinkResult?.timing || null,
    },
  };
}
