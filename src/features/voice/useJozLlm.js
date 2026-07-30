import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchJson, apiUrl } from "../../utils/api";
import { PRIVACY_POLICY_CHAT_SUMMARY } from "./privacyPolicyContent";
import {
  JOZ_LLM_IDENTITY,
  buildJozLlmFallbackReply,
  JOZ_LLM_SUGGESTIONS,
  TARGET_DATA_SCIENTIST_ROLE,
} from "../../shared/jozLlmProfile";
import { getJozLaneConfig, JOZ_LLM_LANES, normalizeJozLaneIntent } from "../../shared/jozLlmLanes";
import { normalizeVoiceAction } from "../../shared/voiceActions";
import { resolveLocalVoiceCommand } from "../../voice/localVoice";
import { requestSemanticSpatialIntent } from "../../world-model/spatialOffer";

const PENDING_MESSAGE_ID = "joz-llm-pending";
const BOOKING_PROMPT = "__JOZ_BOOKING_CALENDAR__";
const CHAT_SEND_COOLDOWN_MS = 1200;
const RATE_LIMIT_COOLDOWN_MS = 10000;
const CHAT_DUPLICATE_WINDOW_MS = 10000;
const CHAT_MAX_INPUT_CHARS = 800;
const GET_CALLED_FLOW_STEPS = ["phone", "time", "name"];
const JOZ_LLM_WELCOME_MESSAGE =
  "Welcome to the state-of-the-art AI experience.\n\nJoz MAXX connects signal reasoning, AI architecture, orchestration, and execution into deployable intelligence.";
const LANDING_ACTION_LABELS = new Set(
  Object.values(JOZ_LLM_LANES).flatMap((lane) => [lane.label, lane.title])
);
const PRIVACY_QUERY_PATTERN =
  /\b(privacy|gdpr|data use|data usage|personal data|my data|your data|how.*data|how.*privacy|data retention|delete my data|erase my data|privacy policy)\b/i;

function isLandingActionUserMessage(message) {
  return (
    message?.role === "user" &&
    LANDING_ACTION_LABELS.has(String(message?.content || "").trim())
  );
}

function replaceLandingPanelMessage(currentMessages, nextMessage) {
  const preservedMessages = currentMessages.filter(
    (message) =>
      message.id !== "assistant-welcome" &&
      !isLandingActionUserMessage(message) &&
      message.kind !== "laneStarter" &&
      message.kind !== "booking"
  );

  return [nextMessage, ...preservedMessages];
}

function cleanAwarenessText(text = "") {
  return String(text || "")
    .replace(/Cross-jumping to/gi, "Opening")
    .replace(/cross-jumps into/gi, "moves into");
}

function detectChatLanguage(text = "") {
  const normalized = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/\b(ukaz|zobraz|okolo mna|pri mne|priestor|priestore|realite|neurony|neuronov|schopnosti|zrucnosti|spusti|otvor)\b/.test(normalized)) {
    return "sk";
  }

  if (/\b(ukazat|zobrazit|kolem me|prostoru|dovednosti)\b/.test(normalized)) {
    return "cs";
  }

  return "en";
}

function localizedThinking(language) {
  if (language === "sk") return "Premýšľam";
  if (language === "cs") return "Přemýšlím";
  return "Thinking";
}

function localizedSpatialLaunched(language) {
  if (language === "sk") return "Priestorový model spustený.";
  if (language === "cs") return "Prostorový model spuštěn.";
  return "Spatial model launched.";
}

function buildBookingMessage() {
  const bookingLane = getJozLaneConfig("booking");
  return {
    id: `assistant-booking-${Date.now()}`,
    role: "assistant",
    content: bookingLane.summary,
    kind: "booking",
    booking: {
      title: bookingLane.title,
      description:
        "Choose the fastest route to reach Joz: call, message, or email.",
      actions: [
        {
          label: "Call Joz",
          href: `tel:${JOZ_LLM_IDENTITY.phone.replace(/\s+/g, "")}`,
        },
        {
          label: "Message Joz",
          href: `https://wa.me/${(JOZ_LLM_IDENTITY.whatsapp || JOZ_LLM_IDENTITY.phone).replace(/\D+/g, "")}`,
        },
        {
          label: "Email Joz",
          href: `mailto:${JOZ_LLM_IDENTITY.email}`,
        },
      ],
    },
  };
}

function buildGetCalledPrompt(step) {
  if (step === "phone") {
    return "Drop the best phone number to call you on.";
  }
  if (step === "time") {
    return "What is the best time to call you?";
  }
  if (step === "name") {
    return "And what name should Joz ask for?";
  }
  return "Share the callback details.";
}

function buildGetCalledSummary(
  { phone = "", time = "", name = "" } = {},
  delivery = {}
) {
  const channels = Array.isArray(delivery?.channels) ? delivery.channels : [];
  const channelLabel = channels.length
    ? channels.join(" and ")
    : "Joz's contact queue";

  if (delivery?.status === "delivered") {
    return `Confirmed. Joz will be in touch with ${name || "you"} on ${phone || "the number provided"} ${time ? `at ${time}` : "at the requested time"}. Your callback request has been sent directly to ${channelLabel}.`;
  }

  if (delivery?.status === "delivery_failed") {
    return `Confirmed. Joz will be in touch with ${name || "you"} on ${phone || "the number provided"} ${time ? `at ${time}` : "at the requested time"}. The request was saved, but direct notification failed, so it needs manual follow-up.`;
  }

  return `Confirmed. Joz will be in touch with ${name || "you"} on ${phone || "the number provided"} ${time ? `at ${time}` : "at the requested time"}. The callback request has been saved for follow-up.`;
}

function buildLaneStarterMessage({
  lane,
  title,
  summary,
  highlights = [],
  actions = [],
}) {
  return {
    id: `assistant-${lane}-${Date.now()}`,
    role: "assistant",
    content: summary,
    kind: "laneStarter",
    laneStarter: {
      lane,
      title,
      summary,
      highlights,
      actions,
    },
  };
}

function buildConfiguredLaneStarterMessage(intentMode) {
  const lane = getJozLaneConfig(intentMode);
  return buildLaneStarterMessage({
    lane: lane.intentMode,
    title: lane.title,
    summary: lane.summary,
    highlights: lane.highlights,
    actions: lane.actions.map((action) => ({
      ...action,
      intentMode: lane.intentMode,
    })),
  });
}

function buildLandingPersistencePayload(intentMode) {
  const normalizedIntent = normalizeJozLaneIntent(intentMode);
  const lane = getJozLaneConfig(normalizedIntent);

  if (normalizedIntent === "booking") {
    const message = buildBookingMessage();
    return {
      label: lane.label,
      assistantContent: message.content,
      metadata: {
        lane: lane.intentMode,
        title: message.booking?.title || lane.title,
      },
    };
  }

  const message = buildConfiguredLaneStarterMessage(normalizedIntent);
  return {
    label: lane.label,
    assistantContent: message.laneStarter?.summary || message.content,
    metadata: {
      lane: message.laneStarter?.lane || lane.intentMode,
      title: message.laneStarter?.title || lane.title,
    },
  };
}

function buildCommandReply(result = {}, currentPortal, options = {}) {
  const normalizedAction =
    normalizeVoiceAction(result?.action) || String(result?.action || "").toLowerCase().trim();
  const awareness = cleanAwarenessText(String(result?.awareness || "").trim());
  const language = options.language || "en";
  const isMobile = Boolean(options.isMobile);

  if (normalizedAction === "brain") {
    return currentPortal === "maxx"
      ? [
          "You are already inside the neurons.",
          "This world is the abstract reasoning layer of the app. It represents MAXX as a living field of neurons rather than a flat interface: philosophy, signal interpretation, intent, and cognitive atmosphere.",
          "Use it as the conceptual engine behind the experience. From here, the user understands the deeper logic, then moves into Meet Joz for applied evidence and execution.",
        ].join("\n\n")
      : [
          "Entering the neurons.",
          "This world is the conceptual core of the app. It frames MAXX as a spatial intelligence system built from neurons: abstract reasoning, agentic intent, and the internal logic behind the experience.",
          "Think of it as the cognitive layer. It explains what the system is about before the user moves into Meet Joz, where the work, skills, and applied AI evidence become concrete.",
        ].join("\n\n");
  }

  if (normalizedAction === "ball") {
    return currentPortal === "meet-joz"
      ? [
          "You are already in Meet Joz.",
          "This world is the execution layer of the app. It turns the concept into proof: who Joz is, how he thinks, what he has built, and where the applied AI, product, and architecture evidence sits.",
          "This is where a hiring manager can move from curiosity into conviction.",
        ].join("\n\n")
      : [
          "Entering Meet Joz.",
          "This world is the human and applied-AI proof layer of the app. It is where the abstract system becomes hiring evidence: background, thinking, product execution, architecture depth, and real-world delivery.",
          "The neurons explain the philosophy. Meet Joz shows the operator behind it.",
        ].join("\n\n");
  }

  if (normalizedAction === "vibe") return awareness || "Opening Flex.";
  if (normalizedAction === "discover") return awareness || "Opening Ascend.";
  if (normalizedAction === "skills") return awareness || "Opening Mogg.";
  if (normalizedAction === "n2x_pause" || normalizedAction === "pause") {
    return awareness || "Pausing the neurons.";
  }
  if (normalizedAction === "n2x_resume" || normalizedAction === "resume") {
    return awareness || "Resuming the neurons.";
  }
  if (normalizedAction === "launch_in_space_n2x" || normalizedAction === "launch_in_space_workf") {
    return awareness || "Opening AR.";
  }
  if (normalizedAction === "experience_spatially") {
    if (isMobile) return localizedSpatialLaunched(language);
    return awareness || "Opening a governed spatial experience.";
  }
  if (normalizedAction === "place_entity_set" || normalizedAction === "preview_entity_set") {
    return awareness || "Preparing a governed spatial placement.";
  }
  if (
    normalizedAction === "contact_joz" ||
    normalizedAction === "call_joz" ||
    normalizedAction === "show_contact_buttons" ||
    normalizedAction === "hide_contact_buttons" ||
    normalizedAction === "back" ||
    normalizedAction === "vibe_back" ||
    normalizedAction === "vibe_back1"
  ) {
    return awareness || "Executing command.";
  }

  return null;
}

function isQuestionLikePrompt(text = "") {
  const clean = String(text || "").trim().toLowerCase();
  if (!clean) return false;
  if (clean.includes("?")) return true;

  return /^(what|why|how|who|when|where|which|tell me|show me|explain|list|give me|can you)\b/.test(
    clean
  );
}

function normalizeChatSignature(text = "") {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isPrivacyQuestion(text = "") {
  const clean = String(text || "").trim().toLowerCase();
  if (!clean) return false;
  return PRIVACY_QUERY_PATTERN.test(clean);
}

function normalizeReplyActions(rawActions = []) {
  const seen = new Set();
  return (Array.isArray(rawActions) ? rawActions : [])
    .map((action) => ({
      id: String(action?.id || "").trim(),
      label: String(action?.label || "").trim(),
      type: String(action?.type || "").trim(),
      href: String(action?.href || "").trim(),
    }))
    .filter((action) => action.id && action.label && action.href)
    .filter((action) => {
      if (seen.has(action.id)) return false;
      seen.add(action.id);
      return true;
    });
}

function inferIntentModeFromCommandResult(result = {}) {
  const action = normalizeVoiceAction(result?.action);
  if (action === "skills") return "skills";
  if (action === "discover") return "business_need";
  if (action === "vibe") return "mindset";
  if (action === "contact_joz" || action === "call_joz") return "booking";
  return "";
}

function isDirectMeetJozControlAction(result = {}) {
  const action = normalizeVoiceAction(result?.action);
  return (
    action === "vibe" ||
    action === "discover" ||
    action === "skills" ||
    action === "back" ||
    action === "vibe_back" ||
    action === "vibe_back1"
  );
}

export function useJozLlm({
  currentPortal,
  currentMesh,
  currentMeshStage,
  executeCommand,
  isMobile = false,
  startOpen = false,
}) {
  const [isOpen, setIsOpen] = useState(() => Boolean(startOpen));
  const [activeIntentMode, setActiveIntentMode] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownDurationMs, setCooldownDurationMs] = useState(0);
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());
  const [messages, setMessages] = useState(() => [
    {
      id: "assistant-welcome",
      role: "assistant",
      content: JOZ_LLM_WELCOME_MESSAGE,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [getCalledFlow, setGetCalledFlow] = useState(null);
  const activeRequestRef = useRef(null);
  const lastSubmissionRef = useRef({ signature: "", timestamp: 0 });

  const suggestions = useMemo(() => JOZ_LLM_SUGGESTIONS, []);

  const toggle = useCallback(() => {
    setIsOpen((current) => !current);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const selectIntentMode = useCallback((intentMode) => {
    const normalizedIntentMode = normalizeJozLaneIntent(intentMode);
    setActiveIntentMode(normalizedIntentMode || "");
  }, []);

  const stopGeneration = useCallback(() => {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    setIsLoading(false);
    setError("");
    setMessages((current) =>
      current.filter((message) => message.id !== PENDING_MESSAGE_ID)
    );
  }, []);

  const startCooldown = useCallback((durationMs, startedAt = Date.now()) => {
    const duration = Math.max(0, Number(durationMs) || 0);

    setCooldownDurationMs(duration);
    setCooldownUntil(duration ? startedAt + duration : 0);
  }, []);

  const startGetCalledFlow = useCallback(() => {
    const startedAt = Date.now();
    setActiveIntentMode("booking");
    setGetCalledFlow({
      step: GET_CALLED_FLOW_STEPS[0],
      data: {
        phone: "",
        time: "",
        name: "",
      },
    });
    setMessages((current) => [
      ...current,
      {
        id: `assistant-get-called-${startedAt}`,
        role: "assistant",
        content: buildGetCalledPrompt("phone"),
      },
    ]);
    setInput("");
    setError("");
  }, []);

  useEffect(() => () => {
    activeRequestRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!cooldownUntil) return undefined;

    const remaining = cooldownUntil - Date.now();
    if (remaining <= 0) {
      setCooldownUntil(0);
      setCooldownDurationMs(0);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCooldownUntil(0);
      setCooldownDurationMs(0);
    }, remaining);

    return () => window.clearTimeout(timeoutId);
  }, [cooldownUntil]);

  useEffect(() => {
    if (!cooldownUntil) return undefined;

    setCooldownNow(Date.now());
    let frameId = 0;

    const updateCooldownNow = () => {
      setCooldownNow(Date.now());
      frameId = window.requestAnimationFrame(updateCooldownNow);
    };

    frameId = window.requestAnimationFrame(updateCooldownNow);

    return () => window.cancelAnimationFrame(frameId);
  }, [cooldownUntil]);

  const persistLandingSelection = useCallback(
    async (intentMode) => {
      const payload = buildLandingPersistencePayload(intentMode);
      if (!payload) return;

      try {
        const response = await fetchJson(apiUrl("/api/joz-llm/landing"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: conversationId || undefined,
            intentMode,
            label: payload.label,
            assistantContent: payload.assistantContent,
            metadata: payload.metadata,
            context: {
              currentPortal,
              currentMesh,
              currentMeshStage,
            },
          }),
        });

        if (response?.conversationId) {
          setConversationId(String(response.conversationId));
        }
      } catch (error) {
        console.error("⚠️ Failed to persist landing selection:", error);
      }
    },
    [conversationId, currentMesh, currentMeshStage, currentPortal]
  );

  const sendMessage = useCallback(
    async (rawValue, options = {}) => {
      const value = String(rawValue || "").trim();
      if (!value || isLoading) return;
      const responseLanguage = detectChatLanguage(value);
      const intentMode = String(options?.intentMode || "").trim().toLowerCase();
      const skipClientGuards = options?.skipClientGuards === true;
      const hasExplicitIntentMode = Boolean(intentMode);
      const useStarter = options?.starter !== false;
      const landingOnly = options?.landingOnly !== false;
      const normalizedRequestedIntentMode = hasExplicitIntentMode
        ? normalizeJozLaneIntent(intentMode)
        : "";
      const now = Date.now();
      const normalizedSignature = normalizeChatSignature(value);

      if (value.length > CHAT_MAX_INPUT_CHARS) {
        setError(`Keep the message under ${CHAT_MAX_INPUT_CHARS} characters.`);
        return;
      }

      if (!skipClientGuards && cooldownUntil && now < cooldownUntil) {
        const remainingSeconds = Math.max(
          1,
          Math.ceil((cooldownUntil - now) / 1000)
        );
        setError(`Wait ${remainingSeconds}s before the next question.`);
        return;
      }

      if (
        !skipClientGuards &&
        normalizedSignature &&
        normalizedSignature === lastSubmissionRef.current.signature &&
        now - lastSubmissionRef.current.timestamp < CHAT_DUPLICATE_WINDOW_MS
      ) {
        setError("That came through already. Give it a moment, then try again.");
        return;
      }

      const messageStamp = Date.now();
      const userMessage = {
        id: `user-${messageStamp}`,
        role: "user",
        content: value,
      };

      if (isPrivacyQuestion(value)) {
        lastSubmissionRef.current = {
          signature: normalizedSignature,
          timestamp: now,
        };
        startCooldown(CHAT_SEND_COOLDOWN_MS, now);
        setMessages((current) => [
          ...current,
          userMessage,
          {
            id: `assistant-privacy-${Date.now()}`,
            role: "assistant",
            content: PRIVACY_POLICY_CHAT_SUMMARY,
          },
        ]);
        setInput("");
        setError("");
        return;
      }

      if (getCalledFlow) {
        const nextData = {
          ...getCalledFlow.data,
          [getCalledFlow.step]: value,
        };
        const currentStepIndex = GET_CALLED_FLOW_STEPS.indexOf(getCalledFlow.step);
        const nextStep = GET_CALLED_FLOW_STEPS[currentStepIndex + 1] || null;

        if (nextStep) {
          setMessages((current) => [
            ...current,
            userMessage,
            {
              id: `assistant-get-called-${Date.now()}`,
              role: "assistant",
              content: buildGetCalledPrompt(nextStep),
            },
          ]);
          setGetCalledFlow({
            step: nextStep,
            data: nextData,
          });
        } else {
          const pendingId = `assistant-get-called-pending-${Date.now()}`;
          setMessages((current) => [
            ...current,
            userMessage,
            {
              id: pendingId,
              role: "assistant",
              content: "Saving callback request...",
              isPending: true,
            },
          ]);
          setGetCalledFlow(null);
          setIsLoading(true);

          try {
            const payload = await fetchJson(apiUrl("/api/joz-llm/callback-request"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                conversationId: conversationId || undefined,
                name: nextData.name,
                phone: nextData.phone,
                time: nextData.time,
                source: "joz_llm_get_called",
                context: {
                  currentPortal,
                  currentMesh,
                  currentMeshStage,
                },
              }),
            });

            if (payload?.conversationId) {
              setConversationId(String(payload.conversationId));
            }

            setMessages((current) => [
              ...current.filter((message) => message.id !== pendingId),
              {
                id: `assistant-get-called-complete-${Date.now()}`,
                role: "assistant",
                content: buildGetCalledSummary(nextData, payload?.delivery || {}),
              },
            ]);
          } catch (requestError) {
            console.error("❌ Callback request failed:", requestError);
            setMessages((current) => [
              ...current.filter((message) => message.id !== pendingId),
              {
                id: `assistant-get-called-error-${Date.now()}`,
                role: "assistant",
                content:
                  "I could not send the callback request just now. Use Call Joz, Message Joz, or Email Joz instead.",
              },
            ]);
          } finally {
            setIsLoading(false);
          }
        }

        setInput("");
        setError("");
        return;
      }

      if (value === BOOKING_PROMPT) {
        lastSubmissionRef.current = {
          signature: normalizedSignature,
          timestamp: now,
        };
        startCooldown(CHAT_SEND_COOLDOWN_MS, now);
        setActiveIntentMode("booking");
        setMessages((current) =>
          landingOnly
            ? replaceLandingPanelMessage(current, buildBookingMessage())
            : [
                ...current,
                {
                  ...userMessage,
                  content: "Meet Joz",
                },
                buildBookingMessage(),
              ]
        );
        if (landingOnly) {
          void persistLandingSelection("booking");
        }
        setInput("");
        setError("");
        return;
      }

      const laneConfig = getJozLaneConfig(intentMode);

      if (hasExplicitIntentMode && useStarter && laneConfig.intentMode === "business_need") {
        lastSubmissionRef.current = {
          signature: normalizedSignature,
          timestamp: now,
        };
        startCooldown(CHAT_SEND_COOLDOWN_MS, now);
        setActiveIntentMode(laneConfig.intentMode);
        setMessages((current) =>
          landingOnly
            ? replaceLandingPanelMessage(current, buildConfiguredLaneStarterMessage(laneConfig.intentMode))
            : [
                ...current,
                {
                  ...userMessage,
                  content: laneConfig.label,
                },
                buildConfiguredLaneStarterMessage(laneConfig.intentMode),
              ]
        );
        if (landingOnly) {
          void persistLandingSelection(laneConfig.intentMode);
        }
        setInput("");
        setError("");
        return;
      }

      if (hasExplicitIntentMode && useStarter && laneConfig.intentMode === "mindset") {
        lastSubmissionRef.current = {
          signature: normalizedSignature,
          timestamp: now,
        };
        startCooldown(CHAT_SEND_COOLDOWN_MS, now);
        setActiveIntentMode(laneConfig.intentMode);
        setMessages((current) =>
          landingOnly
            ? replaceLandingPanelMessage(current, buildConfiguredLaneStarterMessage(laneConfig.intentMode))
            : [
                ...current,
                {
                  ...userMessage,
                  content: laneConfig.label,
                },
                buildConfiguredLaneStarterMessage(laneConfig.intentMode),
              ]
        );
        if (landingOnly) {
          void persistLandingSelection(laneConfig.intentMode);
        }
        setInput("");
        setError("");
        return;
      }

      if (hasExplicitIntentMode && useStarter && laneConfig.intentMode === "skills") {
        lastSubmissionRef.current = {
          signature: normalizedSignature,
          timestamp: now,
        };
        startCooldown(CHAT_SEND_COOLDOWN_MS, now);
        setActiveIntentMode(laneConfig.intentMode);
        setMessages((current) =>
          landingOnly
            ? replaceLandingPanelMessage(current, buildConfiguredLaneStarterMessage(laneConfig.intentMode))
            : [
                ...current,
                {
                  ...userMessage,
                  content: laneConfig.label,
                },
                buildConfiguredLaneStarterMessage(laneConfig.intentMode),
              ]
        );
        if (landingOnly) {
          void persistLandingSelection(laneConfig.intentMode);
        }
        setInput("");
        setError("");
        return;
      }

      const resolvedLocalCommand = resolveLocalVoiceCommand(
        value,
        currentPortal,
        currentMesh,
        currentMeshStage
      );
      const shouldBypassCommandRouting =
        hasExplicitIntentMode &&
        normalizedRequestedIntentMode !== "mindset" &&
        normalizedRequestedIntentMode !== "skills" &&
        !isDirectMeetJozControlAction(resolvedLocalCommand);

      let commandResult = shouldBypassCommandRouting
        ? null
        : resolvedLocalCommand;
      if (!commandResult && !shouldBypassCommandRouting) {
        try {
          commandResult = await requestSemanticSpatialIntent({
            input: value,
            context: {
              currentPortal,
              currentMesh,
              currentMeshStage,
              currentPath: typeof window !== "undefined" ? window.location.pathname : "",
            },
          });
        } catch (semanticIntentError) {
          console.warn("⚠️ Semantic spatial intent unavailable:", semanticIntentError?.message || semanticIntentError);
        }
      }
      const inferredIntentModeFromCommand = commandResult
        ? inferIntentModeFromCommandResult(commandResult)
        : "";
      const effectiveIntentMode = intentMode || inferredIntentModeFromCommand;
      const normalizedEffectiveIntentMode = effectiveIntentMode
        ? normalizeJozLaneIntent(effectiveIntentMode)
        : normalizedRequestedIntentMode;

      if (normalizedEffectiveIntentMode) {
        setActiveIntentMode(normalizedEffectiveIntentMode);
      }

      if (commandResult) {
        let appliedCommandResult = commandResult;

        if (typeof window !== "undefined" && typeof window.__runVoiceInput === "function") {
          try {
            const voiceExecution = await window.__runVoiceInput({
              input: value,
              currentPortal,
              currentMesh,
              currentMeshStage,
            });

            if (voiceExecution?.result) {
              appliedCommandResult = voiceExecution.result;
            }
          } catch (voiceExecutionError) {
            console.error("⚠️ Joz MAXX command fallback to local executor:", voiceExecutionError);
            executeCommand?.(commandResult);
          }
        } else {
          executeCommand?.(commandResult);
        }

        if (isQuestionLikePrompt(value) && effectiveIntentMode) {
          setError("");
        } else {
          setMessages((current) => [
            ...current,
            userMessage,
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content:
                buildCommandReply(appliedCommandResult, currentPortal, {
                  isMobile,
                  language: responseLanguage,
                }) ||
                "Command recognized and executed.",
              spatialIntent: isMobile ? null : appliedCommandResult?.placement || null,
            },
          ]);
          setInput("");
          setError("");
          return;
        }
      }

      const pendingAssistantMessage = {
        id: PENDING_MESSAGE_ID,
        role: "assistant",
        content: localizedThinking(responseLanguage),
        isPending: true,
      };
      lastSubmissionRef.current = {
        signature: normalizedSignature,
        timestamp: now,
      };
      startCooldown(CHAT_SEND_COOLDOWN_MS, now);
      const requestController = new AbortController();
      activeRequestRef.current = requestController;

      const nextMessages = [...messages, userMessage];
      setMessages([...nextMessages, pendingAssistantMessage]);
      setInput("");
      setError("");
      setIsLoading(true);

      try {
        const payload = await fetchJson(apiUrl("/api/joz-llm"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: requestController.signal,
          body: JSON.stringify({
            conversationId: conversationId || undefined,
            messages: nextMessages.map(({ role, content }) => ({ role, content })),
            context: {
              currentPortal,
              currentMesh,
              currentMeshStage,
              targetRole: TARGET_DATA_SCIENTIST_ROLE.title,
              intentMode: effectiveIntentMode || undefined,
            },
          }),
        });

        const reply = String(payload?.reply || "").trim();
        if (!reply) {
          throw new Error("Empty reply");
        }
        if (payload?.conversationId) {
          setConversationId(String(payload.conversationId));
        }

        setMessages((current) => [
          ...current.filter((message) => message.id !== PENDING_MESSAGE_ID),
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: reply,
            actions: normalizeReplyActions(payload?.actions || payload?.recommended_actions),
          },
        ]);
      } catch (requestError) {
        if (requestController.signal.aborted) {
          return;
        }
        if (/API 429:/i.test(String(requestError?.message || ""))) {
          startCooldown(RATE_LIMIT_COOLDOWN_MS);
          setMessages((current) =>
            current.filter((message) => message.id !== PENDING_MESSAGE_ID)
          );
          setError("Wait 10s before the next question.");
          return;
        }
        console.error("❌ Joz MAXX request failed, using local fallback:", requestError);
        setMessages((current) => [
          ...current.filter((message) => message.id !== PENDING_MESSAGE_ID),
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: buildJozLlmFallbackReply(value),
          },
        ]);
        setError("");
      } finally {
        if (activeRequestRef.current === requestController) {
          activeRequestRef.current = null;
        }
        setIsLoading(false);
      }
    },
    [
      currentMesh,
      currentMeshStage,
      currentPortal,
      conversationId,
      executeCommand,
      isLoading,
      isMobile,
      messages,
      getCalledFlow,
      startCooldown,
    ]
  );

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      await sendMessage(input);
    },
    [input, sendMessage]
  );

  const cooldownRemainingMs = Math.max(0, cooldownUntil - cooldownNow);
  const cooldownSeconds = cooldownRemainingMs
    ? Math.max(1, Math.ceil(cooldownRemainingMs / 1000))
    : 0;
  const cooldownProgress =
    cooldownRemainingMs > 0 && cooldownDurationMs > 0
      ? Math.min(1, Math.max(0, 1 - cooldownRemainingMs / cooldownDurationMs))
      : 0;

  return {
    isOpen,
    activeIntentMode,
    selectIntentMode,
    toggle,
    close,
    messages,
    input,
    setInput,
    isLoading,
    error,
    isCoolingDown: cooldownRemainingMs > 0,
    cooldownSeconds,
    cooldownProgress,
    suggestions,
    bookingPrompt: BOOKING_PROMPT,
    startGetCalledFlow,
    sendMessage,
    stopGeneration,
    handleSubmit,
  };
}
