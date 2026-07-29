import { useEffect, useRef } from "react";

import { resolveVoicePipeline } from "./pipeline";

function formatVoiceSeconds(startedAt) {
  if (!startedAt) return "0.00";
  return ((performance.now() - startedAt) / 1000).toFixed(2);
}

function getVoiceProcessLine(currentPortal, currentPhase) {
  if (currentPortal === "maxx" || currentPortal === "the-vibe-energy") {
    if (currentPhase === "inside_the_brain") {
      return "Understanding where you are deeper inside the brain...";
    }
    if (currentPhase) {
      return `Understanding the ${currentPhase.replace(/_/g, " ")} phase...`;
    }
    return "Understanding where you are inside the brain...";
  }

  if (currentPortal === "meet-joz") {
    return "Understanding where you are in Meet Joz...";
  }

  return "Understanding where you are...";
}

export function useVoiceTranscriptPipeline({
  effectiveTranscript,
  isJozLlmOpen,
  isMobile,
  detectImmediateMobileCommand,
  setVoiceProcessLine,
  pushVoiceDebugEvent,
  appendVoiceSessionEntry,
  finalizeVoiceSessionEntry,
  fetchJson,
  apiUrl,
  resolveLocalVoiceCommand,
  applyVoiceReasoningResult,
  dispatchAppAction,
  announcePortalTransition,
  setLocation,
  showContactCta,
  hideContactCta,
  setPendingMeetJozVoiceAction,
  handleVibeClick,
  handleBackClick,
  handleDiscoverClick,
  handleBack1Click,
  handleSkillsClick,
  pendingPortalActionRef,
  agentContext,
  setNativeTranscript,
  resetTranscript,
}) {
  const processClearTimeoutRef = useRef(null);
  const lastMobileVoiceDispatchRef = useRef({ command: "", at: 0 });
  const lastVoiceDispatchRef = useRef({ command: "", at: 0 });

  useEffect(() => {
    return () => {
      if (processClearTimeoutRef.current) {
        window.clearTimeout(processClearTimeoutRef.current);
        processClearTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!effectiveTranscript?.trim()) return;

    const rawInput = effectiveTranscript.trim();
    const rawSpoken = rawInput.toLowerCase();
    if (isMobile && /^(meet|meej)$/.test(rawSpoken)) {
      console.log("🎙️ Waiting for fuller mobile transcript:", rawSpoken);
      return;
    }

    const immediateMobileCommand = isMobile
      ? detectImmediateMobileCommand(rawSpoken)
      : null;
    const spoken = immediateMobileCommand || rawSpoken;
    const debounceMs = isMobile ? (immediateMobileCommand ? 20 : 120) : 500;
    const contextWaitMs = isMobile ? 25 : 100;
    const startedAt = performance.now();

    const delay = setTimeout(async () => {
      const now = Date.now();

      if (spoken) {
        const lastDispatch = lastVoiceDispatchRef.current;
        if (lastDispatch.command === spoken && now - lastDispatch.at < 1800) {
          console.log("🎙️ Skipping duplicate voice command:", spoken);
          return;
        }

        lastVoiceDispatchRef.current = {
          command: spoken,
          at: now,
        };
      }

      if (isMobile && immediateMobileCommand) {
        const lastDispatch = lastMobileVoiceDispatchRef.current;
        if (
          lastDispatch.command === immediateMobileCommand &&
          now - lastDispatch.at < 1200
        ) {
          console.log(
            "🎙️ Skipping duplicate mobile command:",
            immediateMobileCommand
          );
          return;
        }

        lastMobileVoiceDispatchRef.current = {
          command: immediateMobileCommand,
          at: now,
        };
      }

      console.log("🎤 Voice command detected:", spoken);
      pushVoiceDebugEvent({
        status: "heard",
        rawInput: rawSpoken,
        spoken,
        source: "",
        action: "",
        target: "",
        awareness: "",
        error: "",
      });
      appendVoiceSessionEntry({
        status: "heard",
        rawInput: rawSpoken,
        spoken,
        outcome: "pending",
      });
      console.log(
        `⏱️ Voice timing before request (${spoken}): ${formatVoiceSeconds(
          startedAt
        )}s`
      );

      const currentPortal = window.location.pathname.split("/").pop() || "root";
      console.log("🌀 Current portal context:", currentPortal);

      await new Promise((resolve) => setTimeout(resolve, contextWaitMs));

      const currentMesh = window.__currentMesh || null;
      const currentMeshStage = window.__currentMeshStage || null;
      const currentPhase = window.__maxxPhase || null;

      if (processClearTimeoutRef.current) {
        window.clearTimeout(processClearTimeoutRef.current);
        processClearTimeoutRef.current = null;
      }

      setVoiceProcessLine(getVoiceProcessLine(currentPortal, currentPhase));

      resolveVoicePipeline({
        rawInput: rawSpoken,
        isMobile,
        currentPortal,
        currentMesh,
        currentMeshStage,
        context: window.__agentContext || agentContext,
        detectImmediateMobileCommand,
        resolveLocalVoiceCommand,
        fetchJson,
        apiUrl,
      })
        .then((result) => {
          if (result?.source === "local") {
            console.log("🧭 Local reasoning result:", result?.result);
          } else {
            console.log(
              "🧭 Backend reasoning result:",
              result?.backendMode,
              result?.result
            );
          }

          setVoiceProcessLine("Applying that here...");
          processClearTimeoutRef.current = window.setTimeout(() => {
            setVoiceProcessLine("");
            processClearTimeoutRef.current = null;
          }, 2600);

          const applyResult = applyVoiceReasoningResult({
            result: result?.result,
            spoken: result?.spoken || spoken,
            startedAt,
            source: result?.source || "backend",
            isMobile,
            currentPortal,
            currentMesh,
            currentMeshStage,
            announcePortalTransition,
            setLocation,
            showContactCta,
            hideContactCta,
            setPendingMeetJozVoiceAction,
            dispatchAppAction,
            handleVibeClick,
            handleBackClick,
            handleDiscoverClick,
            handleBack1Click,
            handleSkillsClick,
            pendingPortalActionRef,
          });

          pushVoiceDebugEvent({
            status: "applied",
            rawInput: rawSpoken,
            spoken: result?.spoken || spoken,
            source: result?.source || "backend",
            action: result?.result?.action || "",
            target: result?.result?.target || "",
            awareness: result?.result?.awareness || "",
            error: "",
          });
          finalizeVoiceSessionEntry({
            status: "applied",
            rawInput: rawSpoken,
            spoken: result?.spoken || spoken,
            source: result?.source || "backend",
            action: result?.result?.action || "",
            target: result?.result?.target || "",
            awareness: result?.result?.awareness || "",
            outcome: "resolved",
          });
          return applyResult;
        })
        .catch((err) => {
          console.error("❌ Reasoning failed:", err);
          setVoiceProcessLine("The backend did not respond.");
          pushVoiceDebugEvent({
            status: "error",
            rawInput: rawSpoken,
            spoken,
            source: "backend",
            action: "",
            target: "",
            awareness: "",
            error: err?.message || "The backend did not respond.",
          });
          finalizeVoiceSessionEntry({
            status: "error",
            rawInput: rawSpoken,
            spoken,
            source: "backend",
            action: "",
            target: "",
            awareness: "",
            error: err?.message || "The backend did not respond.",
            outcome: "system_error",
          });
          processClearTimeoutRef.current = window.setTimeout(() => {
            setVoiceProcessLine("");
            processClearTimeoutRef.current = null;
          }, 2600);
        });

      if (isMobile) {
        setNativeTranscript("");
      } else {
        resetTranscript?.();
      }
    }, debounceMs);

    return () => clearTimeout(delay);
  }, [
    agentContext,
    announcePortalTransition,
    apiUrl,
    appendVoiceSessionEntry,
    applyVoiceReasoningResult,
    detectImmediateMobileCommand,
    effectiveTranscript,
    fetchJson,
    finalizeVoiceSessionEntry,
    handleBack1Click,
    handleBackClick,
    handleDiscoverClick,
    handleSkillsClick,
    handleVibeClick,
    hideContactCta,
    isMobile,
    isJozLlmOpen,
    pendingPortalActionRef,
    pushVoiceDebugEvent,
    resetTranscript,
    resolveLocalVoiceCommand,
    setLocation,
    setNativeTranscript,
    setPendingMeetJozVoiceAction,
    setVoiceProcessLine,
    showContactCta,
  ]);
}
