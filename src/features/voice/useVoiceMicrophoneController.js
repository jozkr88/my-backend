import { useEffect, useRef, useState } from "react";

export function useVoiceMicrophoneController({
  isMobile,
  browserSupportsSpeechRecognition,
  browserSupportsContinuousListening,
  isMicrophoneAvailable,
  detectImmediateMobileCommand,
  apiFetch,
  apiUrl,
  SpeechRecognition,
  micEnabled,
}) {
  const nativeSpeechRecognitionSupported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const mobileRecorderSupported =
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia);
  const speechRecognitionSupported =
    browserSupportsSpeechRecognition || nativeSpeechRecognitionSupported;
  const micInputSupported =
    speechRecognitionSupported || (isMobile && mobileRecorderSupported);

  const nativeRecognitionRef = useRef(null);
  const nativeRestartTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const micEnabledRef = useRef(false);

  const [nativeTranscript, setNativeTranscript] = useState("");
  const [nativeListening, setNativeListening] = useState(false);
  const [micError, setMicError] = useState("");

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  useEffect(() => {
    if (!micInputSupported && !isMobile) {
      console.warn("⚠️ Microphone input is not supported in this browser.");
      setMicError("Speech recognition is not supported in this browser.");
      return;
    }

    setMicError((current) =>
      current === "Speech recognition is not supported in this browser." ? "" : current
    );
  }, [isMobile, micInputSupported]);

  useEffect(() => {
    if (isMicrophoneAvailable === false) {
      setMicError("Microphone access is blocked. Allow mic permission and try again.");
    }
  }, [isMicrophoneAvailable]);

  useEffect(() => {
    return () => {
      if (nativeRestartTimeoutRef.current) {
        window.clearTimeout(nativeRestartTimeoutRef.current);
      }

      if (nativeRecognitionRef.current) {
        nativeRecognitionRef.current.onend = null;
        nativeRecognitionRef.current.stop?.();
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startMicListening = async () => {
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setMicError("HTTPS is required for microphone access.");
      return false;
    }

    if (!micInputSupported) {
      setMicError("Microphone input is not available in this browser.");
      return false;
    }

    try {
      let stream = null;

      if (navigator.mediaDevices?.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      if (isMobile && !nativeSpeechRecognitionSupported && mobileRecorderSupported) {
        if (!stream) {
          setMicError("Unable to access the microphone on this mobile browser.");
          return false;
        }

        audioChunksRef.current = [];
        mediaStreamRef.current = stream;

        const recorder = new MediaRecorder(stream);
        recorder.onstart = () => {
          setNativeListening(true);
          setNativeTranscript("");
          setMicError("");
        };

        recorder.ondataavailable = (event) => {
          if (event.data?.size) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onerror = (event) => {
          console.error("🎙️ Mobile recorder error:", event);
          setMicError("Unable to record audio on this mobile browser.");
        };

        recorder.onstop = async () => {
          setNativeListening(false);

          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
          }

          try {
            const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            audioChunksRef.current = [];

            if (!blob.size) {
              return;
            }

            const arrayBuffer = await blob.arrayBuffer();
            const response = await apiFetch(apiUrl("/api/transcribe"), {
              method: "POST",
              body: arrayBuffer,
            });

            if (!response.ok) {
              throw new Error(`Transcribe API ${response.status}`);
            }

            const text = (await response.text()).trim();
            if (text) {
              console.log("🎙️ Mobile recorder transcript:", text);
              setNativeTranscript(text);
            }
            setMicError("");
          } catch (transcribeError) {
            console.error("🎙️ Mobile transcribe failed:", transcribeError);
            setMicError("Unable to transcribe audio on mobile.");
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
        return true;
      }

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      if (isMobile && nativeSpeechRecognitionSupported) {
        const NativeRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;

        if (nativeRestartTimeoutRef.current) {
          window.clearTimeout(nativeRestartTimeoutRef.current);
          nativeRestartTimeoutRef.current = null;
        }

        if (nativeRecognitionRef.current) {
          nativeRecognitionRef.current.onend = null;
          try {
            nativeRecognitionRef.current.stop();
          } catch (stopError) {
            console.warn(
              "🎙️ Native mobile recognizer stop before restart failed:",
              stopError
            );
          }
          nativeRecognitionRef.current = null;
        }

        if (!NativeRecognition) {
          setMicError("Speech recognition is not supported in this browser.");
          return false;
        }

        const recognition = new NativeRecognition();
        recognition.lang = "en-US";
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setNativeListening(true);
          setMicError("");
        };

        recognition.onresult = (event) => {
          const results = Array.from(event.results || []).slice(event.resultIndex || 0);
          const spoken = results
            .map((result) => result?.[0]?.transcript || "")
            .join(" ")
            .trim();

          if (!spoken) {
            return;
          }

          const immediateCommand = detectImmediateMobileCommand(spoken);
          const latestResult = results[results.length - 1];
          const isFinal = Boolean(latestResult?.isFinal);

          if (immediateCommand) {
            console.log(
              `🎙️ Native mobile ${isFinal ? "final" : "interim"} command:`,
              immediateCommand
            );
            setNativeTranscript(immediateCommand);
            return;
          }

          if (isFinal) {
            console.log("🎙️ Native mobile transcript:", spoken);
            setNativeTranscript(spoken);
          }
        };

        recognition.onerror = (event) => {
          console.error("🎙️ Native mobile speech error:", event);

          if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
            setMicError("Microphone access is blocked. Allow mic permission and try again.");
          } else if (
            event?.error &&
            event.error !== "no-speech" &&
            event.error !== "aborted"
          ) {
            setMicError("Unable to start speech recognition on this mobile browser.");
          }
        };

        recognition.onend = () => {
          setNativeListening(false);

          if (!micEnabledRef.current) {
            return;
          }

          nativeRestartTimeoutRef.current = window.setTimeout(() => {
            try {
              recognition.start();
            } catch (restartError) {
              console.error("🎙️ Failed to restart native mobile speech:", restartError);
            }
          }, 80);
        };

        nativeRecognitionRef.current = recognition;
        setNativeTranscript("");
        recognition.start();
        setMicError("");
        return true;
      }

      await SpeechRecognition.startListening({
        continuous: !isMobile && browserSupportsContinuousListening,
        language: "en-US",
      });
      setMicError("");
      return true;
    } catch (error) {
      console.error("🎙️ Failed to start microphone:", error);
      setMicError("Unable to start the microphone. Check site permissions.");
      return false;
    }
  };

  const stopMicListening = async () => {
    micEnabledRef.current = false;

    if (nativeRestartTimeoutRef.current) {
      window.clearTimeout(nativeRestartTimeoutRef.current);
      nativeRestartTimeoutRef.current = null;
    }

    if (isMobile && mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      setNativeListening(false);
      mediaRecorderRef.current.stop();

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      return;
    }

    if (isMobile && nativeRecognitionRef.current) {
      const recognition = nativeRecognitionRef.current;
      recognition.onend = null;
      nativeRecognitionRef.current = null;
      recognition.stop();
      setNativeListening(false);
      return;
    }

    await SpeechRecognition.stopListening();
  };

  return {
    nativeTranscript,
    setNativeTranscript,
    nativeListening,
    micError,
    micInputSupported,
    startMicListening,
    stopMicListening,
  };
}
