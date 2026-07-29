import { useEffect } from "react";
import { fetchJson, apiUrl } from "../utils/api";
import { jozSpeak } from "../utils/voice";

// LLM agent reasoning loop
export function useLLMAgenticReasoning(agentState, onAction) {
  useEffect(() => {
    if (!agentState?.userSpeech && !agentState?.contextUpdate) return;

    const controller = new AbortController();

    const runReasoning = async () => {
      try {
        const data = await fetchJson(apiUrl("/api/agentic"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: agentState.userSpeech,
            context: agentState.context || {},
          }),
          signal: controller.signal,
        });

        const intent = data.intent?.toLowerCase?.() || "";
        const params = data.params || {};
        const spoken = data.response || "";

        if (spoken) jozSpeak(spoken);

        onAction({
          ...agentState,
          intent,
          params,
          response: spoken,
          contextUpdate: false,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("🧠 agent reasoning error:", err);
          jozSpeak("I'm having trouble reasoning right now.");
        }
      }
    };

    runReasoning();
    return () => controller.abort();
  }, [agentState.userSpeech, agentState.contextUpdate]);
}
