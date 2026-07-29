import { useEffect, useState } from "react";

/**
 * ✅ React-safe SpeechRecognition wrapper.
 * Always returns a valid hook function (never undefined).
 */
export function useSafeSpeechRecognition() {
  const [speechLib, setSpeechLib] = useState(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)
    ) {
      import("react-speech-recognition")
        .then((mod) => setSpeechLib(mod))
        .catch((err) => console.warn("⚠️ Failed to load speech lib:", err));
    } else {
      console.warn("⚠️ Speech recognition not supported — using stub.");
    }
  }, []);

  // === 1️⃣ Always a defined hook function ===
  const useSpeechRecognitionSafe = () => {
    if (speechLib && typeof speechLib.useSpeechRecognition === "function") {
      try {
        return speechLib.useSpeechRecognition();
      } catch (err) {
        console.warn("⚠️ useSpeechRecognition crashed:", err);
      }
    }
    // Stub fallback (no-op, but keeps React hook order stable)
    return {
      transcript: "",
      listening: false,
      resetTranscript: () => {},
      browserSupportsSpeechRecognition: false,
    };
  };

  // === 2️⃣ Always a defined SpeechRecognition object ===
  const SpeechRecognitionSafe =
    speechLib?.default || {
      startListening: () => console.warn("🛑 SpeechRecognition not available."),
      stopListening: () => {},
      abortListening: () => {},
      browserSupportsSpeechRecognition: () => false,
    };

  // === 3️⃣ Always return stable references ===
  return {
    SpeechRecognition: SpeechRecognitionSafe,
    useSpeechRecognition: useSpeechRecognitionSafe,
  };
}
