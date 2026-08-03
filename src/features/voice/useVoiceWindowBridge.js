import { useEffect } from "react";

import { buildVoiceTestContext, normalizeAgentMesh } from "./context";
import { resolveVoicePipeline } from "./pipeline";

export function useVoiceWindowBridge({
  agentContext,
  currentPortal,
  isMobile,
  detectImmediateMobileCommand,
  resolveLocalVoiceCommand,
  fetchJson,
  apiUrl,
  pushVoiceDebugEvent,
  appendVoiceSessionEntry,
  finalizeVoiceSessionEntry,
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
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__agentContext = agentContext;
  }, [agentContext]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const buildVoiceTestContextForWindow = (overrides = {}) =>
      buildVoiceTestContext({
        overrides,
        agentContext,
        currentPortal,
        isMobile,
        windowCurrentMesh: window.__currentMesh,
        windowCurrentMeshStage: window.__currentMeshStage,
      });

    const voiceTestDebug = async (options = {}) => {
      const rawInput = String(options.input || options.transcript || "").trim();
      const nextIsMobile =
        typeof options.isMobile === "boolean" ? options.isMobile : isMobile;
      const nextPortal =
        String(
          options.currentPortal || options.portal || currentPortal || "root"
        ).trim() || "root";
      const nextStage =
        String(
          options.currentMeshStage ||
            options.stage ||
            window.__currentMeshStage ||
            ""
        )
          .toLowerCase()
          .trim() || null;
      const nextMeshRaw =
        String(options.currentMesh || options.mesh || window.__currentMesh || "")
          .toLowerCase()
          .trim() || null;
      const nextMesh = normalizeAgentMesh({
        currentPortal: nextPortal,
        currentMesh: nextMeshRaw,
        currentMeshStage: nextStage,
      });
      const context = buildVoiceTestContextForWindow({
        currentPortal: nextPortal,
        currentMesh: nextMesh,
        currentMeshStage: nextStage,
        currentPath: options.currentPath,
        isMobile: nextIsMobile,
        effectiveTranscript: rawInput,
      });
      const resolved = rawInput
        ? await resolveVoicePipeline({
            rawInput,
            isMobile: nextIsMobile,
            currentPortal: nextPortal,
            currentMesh: nextMesh,
            currentMeshStage: nextStage,
            context,
            detectImmediateMobileCommand,
            resolveLocalVoiceCommand,
            fetchJson,
            apiUrl,
          })
        : {
            rawLower: "",
            mobileShortcut: null,
            spoken: "",
            source: null,
            result: null,
            backendMode: null,
          };
      const {
        spoken,
        source,
        result: resolvedResult,
        backendMode,
        mobileShortcut,
      } = resolved;

      const needsRetry = result?.status === "needs_retry";

      return {
        rawInput,
        spoken,
        mobileShortcut,
        currentPortal: nextPortal,
        currentMesh: nextMesh,
        currentMeshStage: nextStage,
        isMobile: nextIsMobile,
        localMatched: source === "local",
        localResult: source === "local" ? resolvedResult : null,
        backendCalled: source === "backend",
        backendMode,
        backendAgentic: backendMode === "agentic" ? resolvedResult : null,
        backendThink: backendMode === "think_fallback" ? resolvedResult : null,
        finalSource: source,
        finalResult: resolvedResult,
      };
    };

    window.__getVoiceTestContext = buildVoiceTestContextForWindow;
    window.__testVoiceDebug = voiceTestDebug;

    return () => {
      if (window.__getVoiceTestContext === buildVoiceTestContextForWindow) {
        delete window.__getVoiceTestContext;
      }
      if (window.__testVoiceDebug === voiceTestDebug) {
        delete window.__testVoiceDebug;
      }
    };
  }, [
    agentContext,
    apiUrl,
    currentPortal,
    detectImmediateMobileCommand,
    fetchJson,
    isMobile,
    resolveLocalVoiceCommand,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const runVoiceInput = async (options = {}) => {
      const rawInput = String(options.input || options.transcript || "").trim();
      if (!rawInput) {
        return { ok: false, reason: "empty_input" };
      }

      const nextIsMobile =
        typeof options.isMobile === "boolean" ? options.isMobile : isMobile;
      const nextPortal =
        String(
          options.currentPortal || options.portal || currentPortal || "root"
        ).trim() || "root";
      const nextStage =
        String(
          options.currentMeshStage ||
            options.stage ||
            window.__currentMeshStage ||
            ""
        )
          .toLowerCase()
          .trim() || null;
      const nextMeshRaw =
        String(options.currentMesh || options.mesh || window.__currentMesh || "")
          .toLowerCase()
          .trim() || null;
      const nextMesh = normalizeAgentMesh({
        currentPortal: nextPortal,
        currentMesh: nextMeshRaw,
        currentMeshStage: nextStage,
      });
      const startedAt = performance.now();
      const rawLower = rawInput.toLowerCase();
      const mobileShortcut = nextIsMobile
        ? detectImmediateMobileCommand(rawLower)
        : null;
      const initialSpoken = mobileShortcut || rawLower;

      pushVoiceDebugEvent({
        status: "heard",
        rawInput,
        spoken: initialSpoken,
        source: "",
        action: "",
        target: "",
        awareness: "",
        error: "",
      });
      appendVoiceSessionEntry({
        status: "heard",
        rawInput,
        spoken: initialSpoken,
        outcome: "pending",
      });

      const context =
        window.__getVoiceTestContext?.({
          currentPortal: nextPortal,
          currentMesh: nextMesh,
          currentMeshStage: nextStage,
          currentPath: options.currentPath,
          isMobile: nextIsMobile,
          effectiveTranscript: initialSpoken,
        }) || agentContext;

      const resolved = await resolveVoicePipeline({
        rawInput,
        isMobile: nextIsMobile,
        currentPortal: nextPortal,
        currentMesh: nextMesh,
        currentMeshStage: nextStage,
        context,
        detectImmediateMobileCommand,
        resolveLocalVoiceCommand,
        fetchJson,
        apiUrl,
      });
      const {
        spoken: resolvedSpoken,
        mobileShortcut: resolvedMobileShortcut,
        source,
        result,
      } = resolved;

      applyVoiceReasoningResult({
        result,
        spoken: resolvedSpoken,
        startedAt,
        source: source || "local",
        isMobile: nextIsMobile,
        currentPortal: nextPortal,
        currentMesh: nextMesh,
        currentMeshStage: nextStage,
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
        status: needsRetry ? "needs_retry" : "applied",
        rawInput,
        spoken: resolvedSpoken,
        source: source || "local",
        action: result?.action || "",
        target: result?.target || "",
        awareness: result?.awareness || "",
        error: "",
      });
      finalizeVoiceSessionEntry({
        status: needsRetry ? "needs_retry" : "applied",
        rawInput,
        spoken: resolvedSpoken,
        source: source || "local",
        action: result?.action || "",
        target: result?.target || "",
        awareness: result?.awareness || "",
        outcome: needsRetry ? "needs_retry" : "resolved",
      });

      return {
        ok: true,
        input: rawInput,
        spoken: resolvedSpoken,
        mobileShortcut: resolvedMobileShortcut,
        source: source || "local",
        result,
        currentPath: window.location.pathname,
        suggestionText: window.__agentContext?.voiceState?.suggestionText || null,
      };
    };

    window.__runVoiceInput = runVoiceInput;

    return () => {
      if (window.__runVoiceInput === runVoiceInput) {
        delete window.__runVoiceInput;
      }
    };
  }, [
    agentContext,
    announcePortalTransition,
    apiUrl,
    appendVoiceSessionEntry,
    applyVoiceReasoningResult,
    currentPortal,
    detectImmediateMobileCommand,
    fetchJson,
    finalizeVoiceSessionEntry,
    handleBack1Click,
    handleBackClick,
    handleDiscoverClick,
    handleSkillsClick,
    handleVibeClick,
    hideContactCta,
    isMobile,
    pendingPortalActionRef,
    pushVoiceDebugEvent,
    resolveLocalVoiceCommand,
    setLocation,
    setPendingMeetJozVoiceAction,
    showContactCta,
  ]);
}
