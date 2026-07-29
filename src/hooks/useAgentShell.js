import { useEffect } from "react";

import { useAutonomousAgent } from "./useAutonomousAgent";
import { useBackendWorldSync } from "./useBackendWorldSync";

export function useAgentShell({
  effectiveTranscript,
  agentState,
  setAgentState,
  apiFetch,
  apiUrl,
  fetchJson,
  worldMap,
  llmClient,
  tools,
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__portalSceneDebug = window.__portalSceneDebug || {};
  }, []);

  useEffect(() => {
    console.log("🎙️ Transcript from browser:", effectiveTranscript);
  }, [effectiveTranscript]);

  useBackendWorldSync({ apiFetch, apiUrl, fetchJson, worldMap });

  useAutonomousAgent(agentState, (u) => setAgentState(u), {
    llmClient,
    tools,
    autonomy: true,
    cooldownMs: 2500,
    maxPerMinute: 8,
  });
}
