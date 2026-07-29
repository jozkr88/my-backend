import { useEffect, useRef, useState } from "react";
import { getJozLaneConfig } from "../../shared/jozLlmLanes";
import jozMaxxMark from "../../joz-maxx.svg";
import {
  getWorldModelInspectorMode,
  useWorldModelTelemetry,
  WorldModelInspectorView,
  WorldModelTraceCard,
} from "./worldModelInspector";
import {
  AI_OVERVIEW_LAST_REVIEWED,
  AI_OVERVIEW_SECTIONS,
  PRIVACY_POLICY_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
  TERMS_SECTIONS,
} from "./privacyPolicyContent";

const JOZ_LLM_TRANSITION_MS = 260;
const JOZ_LLM_OPEN_DELAY_MS = 90;
const JOZ_LLM_TRIGGER_RETURN_DELAY_MS = 90;

function AnimatedAssistantCopy({
  messageId,
  text,
  className = "",
  animate = false,
  onComplete,
  onProgress,
}) {
  const [visibleText, setVisibleText] = useState(animate ? "" : text);
  const onCompleteRef = useRef(onComplete);
  const onProgressRef = useRef(onProgress);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    if (!animate) {
      setVisibleText(text);
      return;
    }

    const fullText = String(text || "");
    if (!fullText.length) {
      setVisibleText(text);
      return;
    }

    const revealDurationMs = Math.min(
      1600,
      Math.max(280, fullText.length * 16)
    );
    let frameId = 0;
    let startTime = 0;
    setVisibleText("");

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / revealDurationMs);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const visibleCount = Math.max(
        1,
        Math.floor(fullText.length * easedProgress)
      );

      setVisibleText(fullText.slice(0, visibleCount));
      onProgressRef.current?.();

      if (progress >= 1) {
        setVisibleText(fullText);
        onProgressRef.current?.();
        onCompleteRef.current?.();
        return;
      }

      frameId = window.requestAnimationFrame(step);
    };

    frameId = window.requestAnimationFrame(step);

    return () => window.cancelAnimationFrame(frameId);
  }, [animate, messageId, text]);

  return (
    <div className={`joz-llm-panel__message-copy ${className}`.trim()}>
      {renderFormattedCopy(visibleText)}
    </div>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M9 9.75A2.75 2.75 0 0 1 11.75 7h7.5A2.75 2.75 0 0 1 22 9.75v7.5A2.75 2.75 0 0 1 19.25 20h-7.5A2.75 2.75 0 0 1 9 17.25z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M15 4H6.75A2.75 2.75 0 0 0 4 6.75V15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M15 5h4v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 14 19 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M19 13v4.25A1.75 1.75 0 0 1 17.25 19H6.75A1.75 1.75 0 0 1 5 17.25V6.75A1.75 1.75 0 0 1 6.75 5H11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpeakIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M5 14.5v-5h3.35L13 5.75v12.5L8.35 14.5H5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M16 9.25a4.75 4.75 0 0 1 0 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M18.75 6.75a8.5 8.5 0 0 1 0 10.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect
        x="7"
        y="7"
        width="10"
        height="10"
        rx="2.2"
        fill="currentColor"
      />
    </svg>
  );
}

function renderTextWithEmailLinks(text = "") {
  const value = String(text || "");
  const emailPattern = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = emailPattern.exec(value)) !== null) {
    const [email] = match;
    const start = match.index;

    if (start > lastIndex) {
      parts.push(value.slice(lastIndex, start));
    }

    parts.push(
      <a
        key={`${email}-${start}`}
        className="joz-llm-panel__inline-link"
        href={`mailto:${email}`}
      >
        {email}
      </a>
    );

    lastIndex = start + email.length;
  }

  if (lastIndex < value.length) {
    parts.push(value.slice(lastIndex));
  }

  return parts.length ? parts : value;
}

function renderInlineCopy(text = "", keyPrefix = "copy") {
  const value = String(text || "");
  const parts = value.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={`${keyPrefix}-strong-${index}`}>
          {renderTextWithEmailLinks(part.slice(2, -2))}
        </strong>
      );
    }

    return (
      <span key={`${keyPrefix}-text-${index}`}>
        {renderTextWithEmailLinks(part)}
      </span>
    );
  });
}

function renderFormattedCopy(text = "") {
  const lines = String(text || "").split("\n");

  return lines.map((line, index) => {
    const bulletMatch = line.match(/^\s*[-*•]\s+(.*)$/);
    const numberedMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
    const content = bulletMatch?.[1] || numberedMatch?.[2] || line;

    if (!String(line).trim()) {
      return (
        <div
          key={`spacer-${index}`}
          className="joz-llm-panel__message-spacer"
          aria-hidden="true"
        />
      );
    }

    if (bulletMatch) {
      return (
        <div key={`bullet-${index}`} className="joz-llm-panel__message-line joz-llm-panel__message-line--bullet">
          <span className="joz-llm-panel__message-marker" aria-hidden="true">
            •
          </span>
          <span>{renderInlineCopy(content, `bullet-${index}`)}</span>
        </div>
      );
    }

    if (numberedMatch) {
      return (
        <div key={`number-${index}`} className="joz-llm-panel__message-line joz-llm-panel__message-line--bullet">
          <span className="joz-llm-panel__message-marker" aria-hidden="true">
            {numberedMatch[1]}.
          </span>
          <span>{renderInlineCopy(content, `number-${index}`)}</span>
        </div>
      );
    }

    return (
      <div key={`line-${index}`} className="joz-llm-panel__message-line">
        {renderInlineCopy(content, `line-${index}`)}
      </div>
    );
  });
}

export function VoiceChrome({
  AgentIcon,
  moveTheWorldsSrc,
  justSaySrc,
  helpSlides,
  voiceHintsEnabled,
  voiceSuggestionPrimaryLine,
  voiceSuggestionSecondaryLine,
  voiceSuggestionTertiaryLine,
  voiceSuggestionQuaternaryLine,
  useDarkVoiceSuggestions,
  showAgentButton,
  agentButtonRef,
  handleAgentButtonClick,
  effectiveListening,
  isHelpOpen,
  toggleHelp,
  isHelpRendered,
  isHelpVisible,
  handleHelpOverlayClick,
  handleHelpPanelPointerEnter,
  handleHelpPanelPointerLeave,
  closeHelp,
  handleHelpSlideTouchStart,
  handleHelpSlideTouchEnd,
  helpSlideIndex,
  setHelpSlideIndex,
  micError,
  showContactButtons,
  contactCtaHref,
  contactCtaLabel,
  contactCtaType,
  fadeOut,
  agentContext,
  isJozLlmOpen,
  jozLlmActiveIntentMode,
  selectJozLlmIntentMode,
  toggleJozLlm,
  closeJozLlm,
  jozLlmMessages,
  jozLlmInput,
  setJozLlmInput,
  jozLlmLoading,
  jozLlmError,
  jozLlmCoolingDown,
  jozLlmCooldownSeconds,
  jozLlmCooldownProgress,
  jozLlmSuggestions,
  jozLlmBookingPrompt,
  startGetCalledFlow,
  sendJozLlmMessage,
  stopJozLlmGeneration,
  handleJozLlmSubmit,
  onJozLlmLaneSelect,
}) {
  const businessLane = getJozLaneConfig("business_need");
  const mindsetLane = getJozLaneConfig("mindset");
  const skillsLane = getJozLaneConfig("skills");
  const bookingLane = getJozLaneConfig("booking");
  const jozLlmMessagesRef = useRef(null);
  const jozLlmMessageNodeRefs = useRef({});
  const jozLlmInputRef = useRef(null);
  const pendingLaneStarterScrollRef = useRef(false);
  const jozLlmTransitionTimeoutRef = useRef(null);
  const jozLlmTriggerTimeoutRef = useRef(null);
  const [revealedAssistantMessageIds, setRevealedAssistantMessageIds] = useState(() => new Set());
  const [messageActionStatus, setMessageActionStatus] = useState({});
  const [activeSpokenMessageId, setActiveSpokenMessageId] = useState(null);
  const [isJozLlmRendered, setIsJozLlmRendered] = useState(isJozLlmOpen);
  const [isJozLlmVisible, setIsJozLlmVisible] = useState(isJozLlmOpen);
  const [isJozLlmTriggerHidden, setIsJozLlmTriggerHidden] = useState(isJozLlmOpen);
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false);
  const [trustPanelTab, setTrustPanelTab] = useState("overview");
  const [jozLlmPanelView, setJozLlmPanelView] = useState("ask");
  const worldModelInspectorMode = getWorldModelInspectorMode();
  const { telemetry: worldModelTelemetry, history: worldModelHistory } =
    useWorldModelTelemetry(worldModelInspectorMode);
  const jozLlmActionButtons = [
    {
      label: businessLane.label,
      prompt: businessLane.actions[0]?.prompt || businessLane.summary,
      intentMode: businessLane.intentMode,
    },
    {
      label: mindsetLane.label,
      prompt: mindsetLane.actions[0]?.prompt || mindsetLane.summary,
      intentMode: mindsetLane.intentMode,
    },
    {
      label: skillsLane.label,
      prompt: skillsLane.actions[0]?.prompt || skillsLane.summary,
      intentMode: skillsLane.intentMode,
    },
    {
      label: bookingLane.label,
      prompt: jozLlmBookingPrompt,
      intentMode: bookingLane.intentMode,
    },
  ];
  const bookJozAction = jozLlmActionButtons.find(({ label }) => label === bookingLane.label);
  const jozLlmQuickActions = jozLlmActionButtons.filter(
    ({ label }) => label !== bookingLane.label
  );
  const jozLlmIntroActions = [
    {
      label: businessLane.label,
      prompt: businessLane.actions[0]?.prompt || businessLane.summary,
      intentMode: businessLane.intentMode,
    },
  ];
  const stopScrollPropagation = (event) => {
    event.stopPropagation();
  };
  const stopSceneInteraction = (event) => {
    event.stopPropagation();
  };
  const scrollMessagesToBottom = () => {
    if (!jozLlmMessagesRef.current) return;
    jozLlmMessagesRef.current.scrollTop = jozLlmMessagesRef.current.scrollHeight;
  };
  const scrollMessageIntoView = (messageId) => {
    const container = jozLlmMessagesRef.current;
    const node = jozLlmMessageNodeRefs.current[messageId];
    if (!container || !node) return false;
    const topOffset = 32;
    const containerRect = container.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const targetTop =
      nodeRect.top - containerRect.top + container.scrollTop - topOffset;

    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });
    return true;
  };
  const setTransientMessageStatus = (messageId, status) => {
    setMessageActionStatus((current) => ({
      ...current,
      [messageId]: status,
    }));

    window.setTimeout(() => {
      setMessageActionStatus((current) => {
        if (current[messageId] !== status) return current;
        const next = { ...current };
        delete next[messageId];
        return next;
      });
    }, 1800);
  };
  const getMessageShareText = (message) => {
    if (!message) return "";

    if (message.kind === "booking" && message.booking) {
      const bookingActions = message.booking.actions
        .map((action) => `${action.label}: ${action.href}`)
        .join("\n");

      return [message.content, message.booking.title, message.booking.description, bookingActions]
        .filter(Boolean)
        .join("\n\n");
    }

    if (message.kind === "businessValue" && message.businessValue) {
      const lines = message.businessValue.lines.map((line) =>
        line.map((chunk) => chunk.text).join("")
      );
      const notableSuccess = message.businessValue.notableSuccessItems?.length
        ? [
            message.businessValue.notableSuccessHeading,
            ...message.businessValue.notableSuccessItems.map((item) => `- ${item}`),
          ].join("\n")
        : "";

      return [...lines, notableSuccess].filter(Boolean).join("\n\n");
    }

    if (message.kind === "laneStarter" && message.laneStarter) {
      const laneActions = message.laneStarter.actions
        ?.map((action) => action.label)
        .join("\n");

      return [
        message.laneStarter.title,
        message.laneStarter.summary,
        ...(message.laneStarter.highlights || []).map((item) => `- ${item}`),
        laneActions ? `Follow-ups\n${laneActions}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    }

    return String(message.content || "");
  };
  const handleCopyMessage = async (message) => {
    const text = getMessageShareText(message).trim();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setTransientMessageStatus(message.id, "Copied");
    } catch (error) {
      console.error("Failed to copy Joz MAXX message:", error);
      setTransientMessageStatus(message.id, "Copy failed");
    }
  };
  const handleShareMessage = async (message) => {
    const text = getMessageShareText(message).trim();
    if (!text) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: message.role === "assistant" ? "Joz MAXX" : "Joz Message",
          text,
        });
        setTransientMessageStatus(message.id, "Shared");
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.error("Failed to share Joz MAXX message:", error);
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setTransientMessageStatus(message.id, "Copied");
    } catch (error) {
      console.error("Failed to copy Joz MAXX message for sharing fallback:", error);
      setTransientMessageStatus(message.id, "Share failed");
    }
  };
  const speakText = (text, messageId) => {
    const content = String(text || "").trim();
    if (!content) return;
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setTransientMessageStatus(messageId, "Speech unavailable");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => {
      setActiveSpokenMessageId((current) => (current === messageId ? null : current));
    };
    utterance.onerror = () => {
      setActiveSpokenMessageId((current) => (current === messageId ? null : current));
      setTransientMessageStatus(messageId, "Speech failed");
    };
    setActiveSpokenMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };
  const handleSpeakMessage = (message) => {
    if (!message) return;
    if (
      typeof window !== "undefined" &&
      window.speechSynthesis &&
      window.speechSynthesis.speaking &&
      activeSpokenMessageId === message.id
    ) {
      window.speechSynthesis.cancel();
      setActiveSpokenMessageId(null);
      return;
    }

    speakText(getMessageShareText(message), message.id);
  };

  useEffect(() => {
    if (jozLlmTriggerTimeoutRef.current) {
      window.clearTimeout(jozLlmTriggerTimeoutRef.current);
      jozLlmTriggerTimeoutRef.current = null;
    }

    if (isJozLlmOpen) {
      setIsJozLlmTriggerHidden(true);
      return undefined;
    }

    jozLlmTriggerTimeoutRef.current = window.setTimeout(() => {
      setIsJozLlmTriggerHidden(false);
      jozLlmTriggerTimeoutRef.current = null;
    }, JOZ_LLM_TRIGGER_RETURN_DELAY_MS);

    return () => {
      if (jozLlmTriggerTimeoutRef.current) {
        window.clearTimeout(jozLlmTriggerTimeoutRef.current);
        jozLlmTriggerTimeoutRef.current = null;
      }
    };
  }, [isJozLlmOpen]);

  useEffect(() => {
    if (jozLlmTransitionTimeoutRef.current) {
      window.clearTimeout(jozLlmTransitionTimeoutRef.current);
      jozLlmTransitionTimeoutRef.current = null;
    }

    if (isJozLlmOpen) {
      setIsJozLlmRendered(true);
      jozLlmTransitionTimeoutRef.current = window.setTimeout(() => {
        setIsJozLlmVisible(true);
        jozLlmTransitionTimeoutRef.current = null;
      }, JOZ_LLM_OPEN_DELAY_MS);
      return () => {
        if (jozLlmTransitionTimeoutRef.current) {
          window.clearTimeout(jozLlmTransitionTimeoutRef.current);
          jozLlmTransitionTimeoutRef.current = null;
        }
      };
    }

    setIsJozLlmVisible(false);
    if (!isJozLlmRendered) return undefined;

    jozLlmTransitionTimeoutRef.current = window.setTimeout(() => {
      setIsJozLlmRendered(false);
      jozLlmTransitionTimeoutRef.current = null;
    }, JOZ_LLM_TRANSITION_MS);

    return () => {
      if (jozLlmTransitionTimeoutRef.current) {
        window.clearTimeout(jozLlmTransitionTimeoutRef.current);
        jozLlmTransitionTimeoutRef.current = null;
      }
    };
  }, [isJozLlmOpen, isJozLlmRendered]);

  useEffect(() => {
    return () => {
      if (jozLlmTransitionTimeoutRef.current) {
        window.clearTimeout(jozLlmTransitionTimeoutRef.current);
      }
      if (jozLlmTriggerTimeoutRef.current) {
        window.clearTimeout(jozLlmTriggerTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isJozLlmOpen) return;
    const latestMessage = jozLlmMessages[jozLlmMessages.length - 1];
    if (latestMessage?.kind === "laneStarter" || latestMessage?.kind === "booking") {
      return;
    }
    scrollMessagesToBottom();
  }, [isJozLlmOpen, jozLlmMessages, jozLlmLoading]);

  useEffect(() => {
    if (!isJozLlmOpen || !pendingLaneStarterScrollRef.current) return;

    const latestLandingMessage = [...jozLlmMessages]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" &&
          (message.kind === "laneStarter" || message.kind === "booking")
      );

    if (!latestLandingMessage) return;

    pendingLaneStarterScrollRef.current = false;

    window.requestAnimationFrame(() => {
      if (scrollMessageIntoView(latestLandingMessage.id)) return;
      scrollMessagesToBottom();
    });
  }, [isJozLlmOpen, jozLlmMessages]);

  useEffect(() => {
    if (!isJozLlmOpen) {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setActiveSpokenMessageId(null);
      setIsPrivacyPolicyOpen(false);
      setTrustPanelTab("overview");
      setJozLlmPanelView("ask");
    }
  }, [isJozLlmOpen]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const latestAssistantMessageId = [...jozLlmMessages]
    .reverse()
    .find((message) => message.role === "assistant" && !message.isPending)?.id;
  const completeReveal = (messageId) => {
    if (!messageId) return;
    setRevealedAssistantMessageIds((current) => {
      if (current.has(messageId)) return current;
      const next = new Set(current);
      next.add(messageId);
      return next;
    });
  };

  const handleJozLlmActionClick = (label, prompt, intentMode, href = null) => {
    if (href) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }

    selectJozLlmIntentMode?.(intentMode);

    completeReveal(latestAssistantMessageId);
    pendingLaneStarterScrollRef.current = true;
    sendJozLlmMessage(prompt, {
      intentMode,
      landingOnly: true,
      skipClientGuards: true,
    });
  };

  return (
    <>
      {voiceHintsEnabled &&
        (voiceSuggestionPrimaryLine ||
          voiceSuggestionSecondaryLine ||
          voiceSuggestionTertiaryLine ||
          voiceSuggestionQuaternaryLine) && (
          <div
            className={`voice-suggestions ${
              useDarkVoiceSuggestions ? "voice-suggestions--dark" : ""
            }`}
            aria-live="polite"
          >
            {voiceSuggestionQuaternaryLine && (
              <div className="voice-suggestions__quaternary">
                <span className="voice-suggestions__quaternary-label">
                  {voiceSuggestionQuaternaryLine}
                </span>
              </div>
            )}
            {voiceSuggestionPrimaryLine && (
              <div className="voice-suggestions__primary">
                {voiceSuggestionPrimaryLine}
              </div>
            )}
            {voiceSuggestionSecondaryLine && (
              <div className="voice-suggestions__secondary">
                <span className="voice-suggestions__secondary-label">
                  {voiceSuggestionSecondaryLine}
                </span>
              </div>
            )}
            {voiceSuggestionTertiaryLine && (
              <div className="voice-suggestions__tertiary">
                <span className="voice-suggestions__tertiary-inner">
                  <span className="listening-dot-wrap" aria-hidden="true">
                    <span className="listening-dot" />
                  </span>
                  <span className="voice-suggestions__tertiary-label">
                    {voiceSuggestionTertiaryLine}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

      {showAgentButton && (
        <button
          type="button"
          ref={agentButtonRef}
          onClick={() => {
            if (isJozLlmOpen) return;
            handleAgentButtonClick();
          }}
          className={`ai-agent ${isJozLlmOpen ? "inactive" : "active"}`}
          aria-label="Go Agentic"
          aria-disabled={isJozLlmOpen ? "true" : undefined}
        >
          <span className="ai-agent-stack" aria-hidden="true">
            <AgentIcon className="ai-agent-mark" focusable="false" />
            <span className="ai-agent-glare" />
          </span>
        </button>
      )}

      {isHelpRendered && (
        <div
          className={`voice-help-overlay ${isHelpVisible ? "open" : "closing"}`}
          role="dialog"
          aria-modal="true"
          aria-label="How to use the app and voice commands"
          aria-hidden={!isHelpOpen}
          onClick={handleHelpOverlayClick}
        >
          <div
            className="voice-help-panel"
            onClick={(event) => event.stopPropagation()}
            onPointerEnter={handleHelpPanelPointerEnter}
            onPointerLeave={handleHelpPanelPointerLeave}
          >
            <div className="voice-help-header">
              <p className="voice-help-eyebrow">Exclusive Alpha AI Preview</p>
              <button
                type="button"
                className="voice-help-close"
                aria-label="Email Joz"
                onClick={() => {
                  window.location.href =
                    contactCtaHref ||
                    "mailto:joz@meetjoz.com";
                }}
              >
                <span className="voice-help-close__label">Reach Joz</span>
              </button>
            </div>
            <img
              src={moveTheWorldsSrc}
              alt="Your voice moves the worlds"
              className="voice-help-title-image"
            />
            <img
              src={justSaySrc}
              alt="Just say"
              className="voice-help-subtitle-image"
            />

            <div
              className="voice-help-slideshow"
              aria-label="Preview slides"
              onTouchStart={handleHelpSlideTouchStart}
              onTouchEnd={handleHelpSlideTouchEnd}
            >
              <div
                className="voice-help-slides"
                style={{ transform: `translateX(-${helpSlideIndex * 100}%)` }}
              >
                {helpSlides.map((slide, slideIndex) => (
                  <div key={slideIndex} className="voice-help-slide">
                    <img
                      src={slide.src}
                      alt={`Preview slide ${slideIndex + 1}`}
                      className="voice-help-slide-image"
                      style={{ width: slide.width }}
                    />
                  </div>
                ))}
              </div>
              <div className="voice-help-dots" aria-label="Slide navigation">
                {[0, 1, 2].map((slideIndex) => (
                  <button
                    key={slideIndex}
                    type="button"
                    className={`voice-help-dot ${
                      helpSlideIndex === slideIndex ? "active" : ""
                    }`}
                    aria-label={`Go to slide ${slideIndex + 1}`}
                    aria-pressed={helpSlideIndex === slideIndex}
                    onClick={() => setHelpSlideIndex(slideIndex)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {micError && (
        <div
          style={{
            position: "fixed",
            top: 84,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10000,
            padding: "0.55rem 0.9rem",
            borderRadius: 999,
            background: "rgba(0, 0, 0, 0.72)",
            color: "#fff",
            fontSize: "0.82rem",
            letterSpacing: "0.03em",
            textAlign: "center",
            maxWidth: "min(90vw, 34rem)",
          }}
        >
          {micError}
        </div>
      )}

      {showContactButtons && contactCtaHref && contactCtaLabel && (
        <div className={`contact-buttons ${fadeOut ? "fade-out" : "fade-in"}`}>
          <button
            type="button"
            className={contactCtaType === "call" ? "call-joz-btn" : "email-joz-btn"}
            aria-label={contactCtaLabel}
            onClick={() => {
              window.location.href = contactCtaHref;
            }}
          >
            {contactCtaLabel}
          </button>
        </div>
      )}

      <button
        type="button"
        className={`joz-llm-trigger ${isJozLlmTriggerHidden ? "open" : ""} ${
          effectiveListening && !isJozLlmOpen ? "voice-blocked" : ""
        }`.trim()}
        aria-label={isJozLlmOpen ? "Close Joz MAXX" : "Open Joz MAXX"}
        aria-expanded={isJozLlmOpen}
        aria-disabled={effectiveListening && !isJozLlmOpen ? "true" : undefined}
        onClick={() => {
          if (effectiveListening && !isJozLlmOpen) return;
          toggleJozLlm();
        }}
      >
        <span className="joz-llm-trigger__eyebrow">New</span>
        <img
          className="joz-llm-trigger__logo"
          src={jozMaxxMark}
          alt=""
          aria-hidden="true"
        />
      </button>

      {isJozLlmRendered && (
        <div
          className={`joz-llm-shell ${isJozLlmVisible ? "is-visible" : ""}`.trim()}
          role="dialog"
          aria-modal="false"
          aria-label="Joz MAXX"
          onWheelCapture={stopSceneInteraction}
          onTouchStartCapture={stopSceneInteraction}
          onTouchMoveCapture={stopSceneInteraction}
          onPointerDownCapture={stopSceneInteraction}
          onPointerMoveCapture={stopSceneInteraction}
        >
          <div
            className={`joz-llm-panel ${isJozLlmVisible ? "is-visible" : ""}`.trim()}
            onWheelCapture={stopScrollPropagation}
            onTouchStartCapture={stopScrollPropagation}
            onTouchMoveCapture={stopScrollPropagation}
            onPointerDownCapture={stopScrollPropagation}
            onPointerMoveCapture={stopScrollPropagation}
          >
            <div className="joz-llm-panel__header">
              <div className="joz-llm-panel__header-main">
                {bookJozAction ? (
                  <button
                    type="button"
                    className="joz-llm-panel__action joz-llm-panel__action--header"
                    data-glow="booking"
                    aria-current={jozLlmActiveIntentMode === "booking" ? "true" : undefined}
                    onClick={() => {
                      if (isPrivacyPolicyOpen) {
                        setIsPrivacyPolicyOpen(false);
                        setTrustPanelTab("overview");
                      }
                      handleJozLlmActionClick(
                        bookJozAction.label,
                        bookJozAction.prompt,
                        bookJozAction.intentMode
                      );
                    }}
                    disabled={jozLlmLoading}
                  >
                    {bookJozAction.label}
                  </button>
                ) : null}
              </div>
              <div className="joz-llm-panel__header-controls">
                <span className="joz-llm-panel__header-tag">Alpha</span>
                <button
                  type="button"
                  className={`joz-llm-panel__icon-button ${
                    isPrivacyPolicyOpen ? "is-active" : ""
                  }`.trim()}
                  data-glow="overview"
                  aria-label={isPrivacyPolicyOpen ? "Back to chat" : "Open AI overview"}
                  aria-pressed={isPrivacyPolicyOpen}
                  onClick={() => {
                    setTrustPanelTab("overview");
                    setIsPrivacyPolicyOpen((current) => !current);
                  }}
                >
                  <span className="joz-llm-panel__icon-letter" aria-hidden="true">
                    i
                  </span>
                </button>
                <button
                  type="button"
                  className="joz-llm-panel__close"
                  data-glow="close"
                  aria-label="Close Joz MAXX"
                  onClick={closeJozLlm}
                >
                  Close
                </button>
              </div>
            </div>

            {worldModelInspectorMode !== "off" && !isPrivacyPolicyOpen && (
              <div className="joz-llm-panel__mode-tabs" role="tablist" aria-label="Joz MAXX interface">
                <button
                  type="button"
                  role="tab"
                  aria-selected={jozLlmPanelView === "ask"}
                  className={`joz-llm-panel__mode-tab ${jozLlmPanelView === "ask" ? "is-active" : ""}`.trim()}
                  onClick={() => setJozLlmPanelView("ask")}
                >
                  Ask Joz
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={jozLlmPanelView === "world"}
                  className={`joz-llm-panel__mode-tab ${jozLlmPanelView === "world" ? "is-active" : ""}`.trim()}
                  onClick={() => setJozLlmPanelView("world")}
                >
                  World Model
                </button>
              </div>
            )}

            {!isPrivacyPolicyOpen && jozLlmPanelView === "ask" && (
              <div className="joz-llm-panel__actions">
                {jozLlmQuickActions.map(({ label, prompt, intentMode }) => (
                  <button
                    key={label}
                    type="button"
                    className={`joz-llm-panel__action ${
                      jozLlmActiveIntentMode === intentMode
                        ? "joz-llm-panel__action--active"
                        : "joz-llm-panel__action--static"
                    }`.trim()}
                    data-glow={intentMode === "business_need" ? "business" : intentMode}
                    aria-current={jozLlmActiveIntentMode === intentMode ? "true" : undefined}
                    onClick={() =>
                      handleJozLlmActionClick(label, prompt, intentMode)
                    }
                    disabled={jozLlmLoading}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div
              ref={jozLlmMessagesRef}
              className="joz-llm-panel__messages"
              aria-live="polite"
              onWheelCapture={stopScrollPropagation}
              onTouchStartCapture={stopScrollPropagation}
              onTouchMoveCapture={stopScrollPropagation}
              onPointerDownCapture={stopScrollPropagation}
              onPointerMoveCapture={stopScrollPropagation}
            >
              {isPrivacyPolicyOpen ? (
                <section
                  className="joz-llm-panel__policy"
                  aria-label="Trust and Compliance"
                >
                  <div className="joz-llm-panel__policy-card">
                    <p className="joz-llm-panel__policy-eyebrow">Trust &amp; Compliance</p>
                    <h2 className="joz-llm-panel__policy-hero-title">
                      Information about Joz MAXX
                    </h2>
                    <p className="joz-llm-panel__policy-kicker">
                      AI transparency, privacy, and terms.
                    </p>
                    <div className="joz-llm-panel__policy-tabs" role="tablist" aria-label="Joz MAXX information">
                      {[
                        ["overview", "AI Overview"],
                        ["privacy", "Privacy"],
                        ["terms", "Terms"],
                      ].map(([tab, label]) => (
                        <button
                          key={tab}
                          type="button"
                          role="tab"
                          aria-selected={trustPanelTab === tab}
                          className={`joz-llm-panel__policy-tab ${trustPanelTab === tab ? "is-active" : ""}`.trim()}
                          data-glow={tab}
                          onClick={() => setTrustPanelTab(tab)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="joz-llm-panel__policy-updated">
                      {trustPanelTab === "overview"
                        ? `Last reviewed ${AI_OVERVIEW_LAST_REVIEWED}`
                        : `Last updated ${PRIVACY_POLICY_LAST_UPDATED}`}
                    </p>
                    {(trustPanelTab === "overview"
                      ? AI_OVERVIEW_SECTIONS
                      : trustPanelTab === "privacy"
                        ? PRIVACY_POLICY_SECTIONS
                        : TERMS_SECTIONS
                    ).map((section) => (
                      <div key={section.title} className="joz-llm-panel__policy-section">
                        <h3 className="joz-llm-panel__policy-section-title">
                          {section.title}
                        </h3>
                        {section.paragraphs.map((paragraph) => (
                          <p
                            key={`${section.title}-${paragraph.slice(0, 32)}`}
                            className="joz-llm-panel__policy-copy"
                          >
                            {renderTextWithEmailLinks(paragraph)}
                          </p>
                        ))}
                      </div>
                    ))}
                    {trustPanelTab === "privacy" && (
                      <p className="joz-llm-panel__policy-note">
                        This policy reflects the current app behavior, including stored
                        conversations, callback requests, microphone transcripts, and
                        third-party processing used to deliver responses.
                      </p>
                    )}
                    <p className="joz-llm-panel__policy-note">
                      Joz MAXX can make mistakes. Please verify important information.
                    </p>
                  </div>
                </section>
              ) : jozLlmPanelView === "world" ? (
                <WorldModelInspectorView
                  telemetry={worldModelTelemetry}
                  history={worldModelHistory}
                  mode={worldModelInspectorMode}
                  onBack={() => setJozLlmPanelView("ask")}
                />
              ) : jozLlmMessages.map((message) => (
                (() => {
                  const isIntroMessage = message.id === "assistant-welcome";
                  const introMessageClassName = isIntroMessage
                    ? "joz-llm-panel__message-copy--intro"
                    : "";
                  const pendingMessageClassName = message.isPending
                    ? "joz-llm-panel__message-copy--pending"
                    : "";

                  return (
                <div
                  key={message.id}
                  ref={(node) => {
                    if (node) {
                      jozLlmMessageNodeRefs.current[message.id] = node;
                    } else {
                      delete jozLlmMessageNodeRefs.current[message.id];
                    }
                  }}
                  className={`joz-llm-panel__message joz-llm-panel__message--${message.role}`}
                >
                  <span className="joz-llm-panel__message-role">
                    {message.role === "assistant" ? "Joz MAXX" : "You"}
                  </span>
                  {message.kind === "booking" && message.booking ? (
                    <div className="joz-llm-panel__booking">
                      <AnimatedAssistantCopy
                        messageId={message.id}
                        text={message.content}
                        className={introMessageClassName}
                        animate={
                          message.id === latestAssistantMessageId &&
                          !revealedAssistantMessageIds.has(message.id)
                        }
                        onComplete={() => {
                          setRevealedAssistantMessageIds((current) => {
                            if (current.has(message.id)) return current;
                            const next = new Set(current);
                            next.add(message.id);
                            return next;
                          });
                        }}
                      />
                      <div className="joz-llm-panel__booking-card">
                        <div className="joz-llm-panel__booking-title">
                          {message.booking.title}
                        </div>
                        <p className="joz-llm-panel__booking-description">
                          {message.booking.description}
                        </p>
                        <div className="joz-llm-panel__booking-actions">
                          {message.booking.actions.map((action) => (
                            <button
                              key={action.label}
                              type="button"
                              className="joz-llm-panel__booking-action"
                              data-glow={action.actionType || "booking"}
                              onClick={() => {
                                if (action.actionType === "get_called") {
                                  startGetCalledFlow?.();
                                  return;
                                }
                                if (action.href.startsWith("http")) {
                                  window.open(action.href, "_blank", "noopener,noreferrer");
                                  return;
                                }
                                window.location.href = action.href;
                              }}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : message.kind === "laneStarter" && message.laneStarter ? (
                    <div className="joz-llm-panel__lane-starter">
                      <div className="joz-llm-panel__lane-card">
                        <div className="joz-llm-panel__lane-header">
                          <div className="joz-llm-panel__lane-title">
                            {message.laneStarter.title}
                          </div>
                        </div>
                        <AnimatedAssistantCopy
                          messageId={message.id}
                          text={message.laneStarter.summary}
                          animate={
                            message.id === latestAssistantMessageId &&
                            !revealedAssistantMessageIds.has(message.id)
                          }
                          onComplete={() => {
                            setRevealedAssistantMessageIds((current) => {
                              if (current.has(message.id)) return current;
                              const next = new Set(current);
                              next.add(message.id);
                              return next;
                            });
                          }}
                        />
                        <div className="joz-llm-panel__lane-highlights">
                          {message.laneStarter.highlights.map((item) => (
                            <div key={item} className="joz-llm-panel__lane-highlight">
                              <span className="joz-llm-panel__lane-highlight-dot" aria-hidden="true" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                        {!!message.laneStarter.actions?.length && (
                          <div className="joz-llm-panel__lane-followups">
                            {message.laneStarter.actions.map((action) => (
                              <button
                                key={action.label}
                                type="button"
                                className="joz-llm-panel__lane-followup"
                                data-glow={action.intentMode || action.actionType || "followup"}
                                onClick={() => {
                                  if (action.actionType === "lane_select") {
                                    onJozLlmLaneSelect?.(action.intentMode);
                                    return;
                                  }

                                  if (action.href) {
                                    window.open(action.href, "_blank", "noopener,noreferrer");
                                    return;
                                  }

                                  sendJozLlmMessage(action.prompt, {
                                    intentMode: action.intentMode,
                                    starter: false,
                                    skipClientGuards: true,
                                  });
                                }}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : message.kind === "businessValue" && message.businessValue ? (
                    <div className="joz-llm-panel__business-value">
                      {message.businessValue.lines.map((line, lineIndex) => (
                        <div
                          key={`${message.id}-line-${lineIndex}`}
                          className="joz-llm-panel__business-value-line"
                        >
                          <AnimatedAssistantCopy
                            messageId={`${message.id}-line-${lineIndex}`}
                            text={line.map((chunk) => chunk.text).join("")}
                            animate={
                              message.id === latestAssistantMessageId &&
                              !revealedAssistantMessageIds.has(message.id)
                            }
                            onProgress={scrollMessagesToBottom}
                            onComplete={() => {
                              if (lineIndex !== message.businessValue.lines.length - 1) return;
                              setRevealedAssistantMessageIds((current) => {
                                if (current.has(message.id)) return current;
                                const next = new Set(current);
                                next.add(message.id);
                                return next;
                              });
                            }}
                          />
                        </div>
                      ))}
                      {message.businessValue.notableSuccessHeading && (
                        <div className="joz-llm-panel__business-value-section">
                          <div className="joz-llm-panel__business-value-heading">
                            {message.businessValue.notableSuccessHeading}
                          </div>
                          <div className="joz-llm-panel__business-value-list">
                            {message.businessValue.notableSuccessItems.map((item, itemIndex) => (
                              <div
                                key={`${message.id}-success-${itemIndex}`}
                                className="joz-llm-panel__business-value-item"
                              >
                                <span className="joz-llm-panel__business-value-bullet" aria-hidden="true">
                                  •
                                </span>
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <AnimatedAssistantCopy
                        messageId={message.id}
                        text={message.content}
                        className={`${introMessageClassName} ${pendingMessageClassName}`.trim()}
                        animate={
                          message.role === "assistant" &&
                          !message.isPending &&
                          message.id === latestAssistantMessageId &&
                          !revealedAssistantMessageIds.has(message.id)
                        }
                        onProgress={scrollMessagesToBottom}
                        onComplete={() => {
                          if (message.role !== "assistant" || message.isPending) return;
                          setRevealedAssistantMessageIds((current) => {
                            if (current.has(message.id)) return current;
                            const next = new Set(current);
                            next.add(message.id);
                            return next;
                          });
                        }}
                      />
                      {isIntroMessage && (
                        <p className="joz-llm-panel__intro-hint">
                          Start with{" "}
                          {jozLlmIntroActions.map((action) => (
                            <button
                              key={action.label}
                              type="button"
                              className="joz-llm-panel__intro-action"
                              onClick={() =>
                                handleJozLlmActionClick(
                                  action.label,
                                  action.prompt,
                                  action.intentMode
                                )
                              }
                              disabled={jozLlmLoading}
                            >
                              {action.label}
                            </button>
                          ))}{" "}
                          or type <span className="joz-llm-panel__intro-hint-accent">Enter the Brain</span>,
                          or ask Joz anything.
                        </p>
                      )}
                      {!!message.actions?.length && (
                        <div className="joz-llm-panel__lane-followups">
                          {message.actions.map((action) => (
                            <button
                              key={action.id}
                              type="button"
                              className="joz-llm-panel__lane-followup"
                              onClick={() => {
                                if (/^https?:/i.test(action.href)) {
                                  window.open(action.href, "_blank", "noopener,noreferrer");
                                  return;
                                }
                                window.location.href = action.href;
                              }}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <div className="joz-llm-panel__message-actions">
                    {message.role === "assistant" && !message.isPending && (
                      <button
                        type="button"
                        className={`joz-llm-panel__message-action ${
                          activeSpokenMessageId === message.id ? "is-active" : ""
                        }`}
                        aria-label={
                          activeSpokenMessageId === message.id
                            ? "Stop reading answer"
                            : "Read answer aloud"
                        }
                        onClick={() => handleSpeakMessage(message)}
                      >
                        <SpeakIcon />
                      </button>
                    )}
                    <button
                      type="button"
                      className="joz-llm-panel__message-action"
                      aria-label="Copy message"
                      onClick={() => handleCopyMessage(message)}
                    >
                      <CopyIcon />
                    </button>
                    <button
                      type="button"
                      className="joz-llm-panel__message-action"
                      aria-label="Share message"
                      onClick={() => handleShareMessage(message)}
                    >
                      <ShareIcon />
                    </button>
                    {messageActionStatus[message.id] && (
                      <span className="joz-llm-panel__message-status" aria-live="polite">
                        {messageActionStatus[message.id]}
                      </span>
                    )}
                  </div>
                </div>
                  );
                })()
              ))}
            </div>

            {!isPrivacyPolicyOpen && jozLlmPanelView === "ask" && (
              <WorldModelTraceCard
                telemetry={worldModelTelemetry}
                onOpen={() => setJozLlmPanelView("world")}
              />
            )}

            {!isPrivacyPolicyOpen && jozLlmPanelView === "ask" && (
              <form
                className="joz-llm-panel__composer"
                onSubmit={handleJozLlmSubmit}
                onWheelCapture={stopScrollPropagation}
                onTouchStartCapture={stopScrollPropagation}
                onTouchMoveCapture={stopScrollPropagation}
              >
                <div className="joz-llm-panel__input-wrap">
                {jozLlmCoolingDown && (
                  <div className="joz-llm-panel__cooldown" aria-live="polite">
                    <div
                      className="joz-llm-panel__cooldown-ring"
                      style={{
                        "--cooldown-progress": `${jozLlmCooldownProgress || 0}`,
                      }}
                      aria-hidden="true"
                    >
                      <span>{jozLlmCooldownSeconds || 0}</span>
                    </div>
                    <p className="joz-llm-panel__cooldown-copy">
                      Wait {jozLlmCooldownSeconds || 0}s before the next question.
                    </p>
                  </div>
                )}
                <textarea
                  ref={jozLlmInputRef}
                  className="joz-llm-panel__input"
                  value={jozLlmInput}
                  onChange={(event) => setJozLlmInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleJozLlmSubmit(event);
                    }
                  }}
                  placeholder="Ask about the Gold Pill, Ascend, Mogg, or neomaxxing - or submit your business need."
                  rows={2}
                  disabled={jozLlmLoading}
                />
                <button
                  type={jozLlmLoading ? "button" : "submit"}
                  className="joz-llm-panel__send"
                  aria-label={jozLlmLoading ? "Stop generating response" : "Send message"}
                  disabled={
                    !jozLlmLoading &&
                    (!String(jozLlmInput || "").trim() || jozLlmCoolingDown)
                  }
                  onClick={jozLlmLoading ? stopJozLlmGeneration : undefined}
                >
                  {jozLlmLoading ? <StopIcon /> : <span aria-hidden="true">↗</span>}
                </button>
                </div>
              </form>
            )}

            {!isPrivacyPolicyOpen && jozLlmError && !jozLlmCoolingDown && (
              <div className="joz-llm-panel__error">{jozLlmError}</div>
            )}

          </div>
        </div>
      )}

      <pre
        id="agent-context-json"
        style={{ display: "none" }}
        aria-hidden="true"
      >
        {JSON.stringify(agentContext)}
      </pre>
    </>
  );
}
