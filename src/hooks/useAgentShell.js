import { useEffect } from "react";

import { useAutonomousAgent } from "./useAutonomousAgent";

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

  useAutonomousAgent(agentState, (u) => setAgentState(u), {
    llmClient,
    tools,
    autonomy: true,
    cooldownMs: 2500,
    maxPerMinute: 8,
  });
}
