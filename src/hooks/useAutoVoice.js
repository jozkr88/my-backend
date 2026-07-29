import { useEffect, useRef } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { useLocation } from "wouter";
import { fetchJson, getThinkUrl } from "../utils/api";
import { appPath } from "../utils/paths";

export function useAutoVoice(agentState, setAgentState) {
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } =
    useSpeechRecognition();

  const [, setLocation] = useLocation();
  const lastTranscriptRef = useRef("");
  const resetTimeout = useRef(null);

  // === 🎙️ MAIN VOICE LOGIC ===
  useEffect(() => {
    if (!transcript) return;

    const spoken = String(transcript).trim();
    if (!spoken || spoken === lastTranscriptRef.current) return;
    lastTranscriptRef.current = spoken;

    console.log("🎙️ Voice heard:", spoken);

    // 🌀 ENTER / EXPLORE — open The Vibe Energy portal
    if (/\b(enter|explore|open\s+portal|go\s+in|step\s+inside)\b/i.test(spoken)) {
      console.log("🧠 Voice: ENTER detected → Opening The Vibe Energy portal");
      try {
        setLocation("/neo/maxx");
        console.log("🚀 Navigated to /neo/maxx");

        // Trigger same GLB animation as clicking the brain mesh
        window.__triggerControlledGLB?.("enter");
      } catch (err) {
        console.error("⚠️ Navigation failed, using fallback:", err);
        window.location.href = appPath("/neo/maxx");
      }
      resetTranscript();
      return;
    }

    // 🔙 BACK navigation (global fallback)
    if (/\b(go\s)?back|previous|exit|return\b/i.test(spoken)) {
      console.log("🔙 Voice: BACK detected → Navigating back");
      window.history.back();
      resetTranscript();
      return;
    }

    // 🧠 Otherwise, send the phrase to backend reasoning
    const currentPortal = window.location.pathname.split("/").pop() || "root";

    fetchJson(getThinkUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: spoken, currentPortal }),
    })
      .then(({ action, target }) => {
        console.log("🎯 Backend decided:", action, "→ target:", target);

        // --- 🧭 Handle navigation first ---
        if (target) {
          console.log("🚀 Navigating to:", target);
          setLocation(target);
          return;
        }

        // --- 🎬 Handle local GLB actions (voice → animation) ---
        if (action) {
          // Normalize name for n2x glb e.g. "n2x_pause" → direct trigger
          console.log("🎬 Voice trigger (normalized):", action);
          if (typeof window.__triggerControlledGLB === "function") {
            window.__triggerControlledGLB(action);
          } else if (
            window.__controlledGLBRegistry &&
            typeof window.__controlledGLBRegistry[action] === "function"
          ) {
            // Fallback: call the registered handler manually
            console.log("🎧 Directly invoking registered GLB handler for:", action);
            window.__controlledGLBRegistry[action]();
          } else {
            console.warn("⚠️ No handler found for:", action);
          }
        } else {
          console.warn("⚠️ No valid action returned from backend.");
        }
      })
      .catch((err) => console.error("❌ Backend fetch failed:", err));

    // Auto-reset transcript after short delay
    clearTimeout(resetTimeout.current);
    resetTimeout.current = setTimeout(() => resetTranscript(), 2000);
  }, [transcript, resetTranscript, setLocation]);

  // === 🎤 KEEP MICROPHONE ALWAYS ON ===
  useEffect(() => {
    if (!browserSupportsSpeechRecognition) {
      console.warn("⚠️ Speech recognition not supported in this browser.");
      return;
    }

    const startMic = () => {
      console.log("🎙️ Activating microphone...");
      SpeechRecognition.startListening({
        continuous: true,
        interimResults: false,
        language: "en-US",
      });
    };

    startMic();

    const interval = setInterval(() => {
      if (!listening) {
        console.log("🔁 Restarting mic automatically");
        startMic();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [listening, browserSupportsSpeechRecognition]);

  return { transcript, listening };
}
