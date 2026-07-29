import { useEffect, useRef } from "react";
import { fetchJson, getThinkUrl } from "../utils/api";
import { appPath } from "../utils/paths";

export function useAutonomousAgent(transcript) {
  const lastCommand = useRef("");

  useEffect(() => {
    let spoken = "";

    try {
      // 🧠 Normalize transcript safely
      if (typeof transcript === "string") {
        spoken = String(transcript || "").trim();
      } else if (Array.isArray(transcript)) {
        spoken = transcript.filter((t) => typeof t === "string").join(" ").trim();
      } else if (transcript && typeof transcript === "object") {
        spoken =
          transcript.transcript?.trim?.() ||
          transcript.text?.trim?.() ||
          transcript.speech?.trim?.() ||
          transcript.finalTranscript?.trim?.() ||
          transcript.partialTranscript?.trim?.() ||
          "";
      }
    } catch (err) {
      console.warn("⚠️ Transcript normalization failed:", err, transcript);
      spoken = "";
    }

    // 🧩 Ignore if no new command
    if (!spoken || spoken === lastCommand.current) return;
    lastCommand.current = spoken;

    (async () => {
      try {
        console.log("🎤 Sending spoken command:", spoken);

        // Try backend reasoning
        let command = "";
        try {
          const data = await fetchJson(getThinkUrl(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: spoken }),
          });
          command = data.action?.trim?.().toLowerCase?.() || "";
          console.log("🤖 Backend interpreted as:", command);
        } catch (networkErr) {
          console.warn("⚠️ Backend not reachable, using local fallback:", networkErr);
        }

        // 🧠 Local fallback (if backend fails or misfires)
        if (!command) {
          const lower = spoken.toLowerCase();
          if (/(^|\b)(enter|open|go in|start|begin)(\b|$)/.test(lower)) command = "explore";
          else if (/flex|energy/.test(lower)) command = "flex";
          else if (/skill/.test(lower)) command = "skills";
          else if (/discover|explore more/.test(lower)) command = "discover";
          else if (/back|exit|return/.test(lower)) command = "back";
          else if (/pause|stop/.test(lower)) command = "pause";
          else if (/resume|continue/.test(lower)) command = "resume";
          console.log("🧠 Local fallback decided:", command);
        }

        // 🚦 Perform the decided action
        if (!command) return;

        // 🌀 ENTER / EXPLORE = navigate to portal
        if (["enter", "explore"].includes(command)) {
          console.log("🌀 Voice: ENTER / EXPLORE → navigating to The Vibe Energy portal");
          try {
            if (window.setLocation) {
              window.setLocation("/neo/maxx");
            } else if (typeof window.navigate === "function") {
              window.navigate("/neo/maxx");
            } else {
              window.location.href = appPath("/neo/maxx");
            }
          } catch (err) {
            console.error("⚠️ Navigation failed:", err);
          }
          return;
        }

        // 🪩 Other 3D actions
        const glbMap = {
          pause: "back1",
          resume: "skills",
          back: "back",
          flex: "Vibe",
          vibe: "Vibe",
          skills: "skills",
          discover: "Discover",
        };

        const mesh = glbMap[command] || command;

        if (typeof window.__triggerControlledGLB === "function") {
          console.log("🎬 Triggering GLB mesh:", mesh);
          window.__triggerControlledGLB(mesh);
        } else {
          console.warn("⚠️ window.__triggerControlledGLB not defined");
        }
      } catch (err) {
        console.error("❌ Error in useAutonomousAgent:", err);
      }
    })();
  }, [transcript]);
}
