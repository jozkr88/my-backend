import express from "express";
import cors from "cors";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "url";
import {
  appendJozMessage,
  appendBusinessValueCaseEvent,
  upsertBusinessValueEvidence,
  cleanupExpiredJozData,
  createJozPrivacyRequest,
  createJozAIComplianceIncident,
  createJozCallbackRequest,
  createJozConversation,
  deleteJozPrivacyBundle,
  exportJozPrivacyBundle,
  getPortalTransition,
  getBusinessValueCase,
  getPrimaryJozProfile,
  getJozDataControlOverview,
  getJozDocumentsByIntent,
  getJozSemanticDocumentsByQuery,
  getStructuredWorldState,
  getWorldTransitionExperience,
  initDatabase,
  isDatabaseEnabled,
  isDatabaseRequired,
  listRecentJozLlmRequestEvents,
  listRecentJozLlmEvaluations,
  listJozLlmRepairCandidates,
  loadJozActionProposal,
  saveJozActionProposal,
  updateJozActionProposal,
  logReasoningEvent,
  logJozLlmRequestEvent,
  recordWorldModelTrajectory,
  upsertBusinessValueCase,
  reviewBusinessValueEvidence,
  reviewJozLlmRepairCandidate,
  reviewJozLlmRequestEvent,
} from "./db.js";
import {
  APP_CONTEXT,
  SITE_TARGETS,
  classifyGlobalCommand,
  classifyMaxxCommand,
  classifyMeetJozCommand,
  classifyRootCommand,
  classifyUtilityCommand,
  detectMeetJozCommandKey,
  getWorldContext,
  normalizeAction,
  normalizeMeshName,
  normalizeTranscript,
  safeTarget,
  applyMeetJozGuardrails,
  canonicalTargetForMesh,
} from "./think-logic.js";
import { resolveAgenticAction } from "./world-agent.js";
import { approveAgentProposal, buildAgentSnapshot, buildFallbackAgentReply } from "./full-agent.js";
import { buildReasoningLayers } from "./reasoning-layers.js";
import {
  buildMeetJozWorldAnswerContext,
  buildMeetJozWorldAwarenessReply,
  buildMeetJozWorldAwarenessResolution,
  resolveMeetJozWorldEntity,
  validateAppContext,
} from "./shared/meetJozWorld.js";
import {
  buildCanonicalWorldState,
  buildPredictionTrace,
  chooseWorldPlan,
  evaluateWorldPlans,
} from "./shared/worldSimulator.js";
import { evaluateProbabilisticPlans } from "./shared/worldExperience.js";
import {
  WORLD_MODEL_VERSION,
  WORLD_TRANSITION_RULE_VERSION,
  buildWorldTrajectoryRecord,
} from "./shared/worldTrajectory.js";
import {
  observeWorld,
  predictObservation,
} from "./shared/worldObservation.js";
import {
  classifyWorldTrajectory,
  isLikelyWorldModelBot,
  normalizeWorldModelControls,
  shouldSampleWorldTrajectory,
} from "./shared/worldModelControls.js";
import {
  loadLearnedWorldModel,
  predictLearnedNextStates,
} from "./shared/learnedWorldModel.js";
import {
  buildJozLlmContext,
  enforceJozLlmReplyLimit,
} from "./shared/jozLlmProfile.js";
import {
  assertNoFallbackHijack,
  buildJozInScopeFallbackRepair,
  buildJozRouteTrace,
  buildRoleAwareJozContext,
  composeJozLlmRouteReply,
  buildVisitorLocationReply,
  enforceJozCommercialBoundaryResolution,
  resolveUnknownJozReply,
  routeJozLlmQueryWithAwareness,
  routeJozLlmQuery,
} from "./shared/jozLlmRouter.js";
import { buildJozResponseVerification } from "./shared/jozLlmObservability.js";
import { buildBusinessValueDiagnosticState } from "./shared/businessValueDiagnostic.js";
import {
  AI_ACT_GOVERNANCE_VERSION,
  AI_DISCLOSURE_TEXT,
  AI_MACHINE_READABLE_DISCLOSURE,
  JOZ_AI_SYSTEM_CARD,
  applyBusinessValueGovernance,
  assessAIActUse,
  buildAIActRestrictedReply,
} from "./shared/aiActGovernance.js";
import {
  dedupeBusinessValueEvidence,
  ingestBusinessValueDocument,
} from "./shared/businessValueEvidence.js";
import { extractBusinessValueFile } from "./shared/businessValueFileExtraction.js";
import { runBusinessValueWorkerDiagnostic } from "./shared/businessValueWorker.js";
import {
  createJozQueryEmbedding,
  getJozEmbeddingModel,
  isJozPgvectorEnabled,
  mergeJozRetrievalResults,
} from "./shared/jozHybridRetrieval.js";
import {
  getJozKnowledgeGraphMode,
} from "./shared/jozKnowledgeGraph.js";
import { queryJozKnowledgeGraphRuntime } from "./shared/neo4jJozKnowledgeGraph.js";
import {
  createJozModelGateway,
  getJozModelRuntimeDescriptor,
  isJozModelGatewayAvailable,
} from "./shared/jozModelGateway.js";
import { requireJozAuth } from "./shared/jozAuth.js";
import { classifyJozAudience } from "./shared/jozAudienceClassifier.js";
import { resolveJozRequestGeo } from "./shared/jozGeoLocation.js";
import {
  approveJozActionProposal,
  beginJozActionExecution,
  completeJozActionExecution,
  getJozActionProposalRecord,
  hydrateJozActionProposal,
  registerJozActionProposal,
} from "./shared/jozActionProposals.js";
import {
  executeJozAllowlistedAction,
  verifyJozAllowlistedAction,
} from "./shared/jozActionExecutor.js";
import {
  buildJozAgentPlan,
  buildJozRiskGateResolution,
  buildJozSafetyRefusalResolution,
  classifyJozIntent,
} from "./shared/jozIntent.js";

const execFileAsync = promisify(execFile);

dotenv.config();

await initDatabase();

const JOZ_BUILD_ID = String(
  process.env.RENDER_GIT_COMMIT ||
  process.env.COMMIT_SHA ||
  process.env.JOZ_BUILD_ID ||
  "local"
).trim();
const JOZ_ROUTER_VERSION = "2026-07-24-intake-hardening-1";
// Production deployments opt into the predictive layer in shadow mode. An
// explicit JOZ_WORLD_MODEL_MODE=off still disables it for rollback or local
// baseline comparisons; shadow prediction never authorises live actions.
const WORLD_MODEL_MODE = String(
  process.env.JOZ_WORLD_MODEL_MODE ||
    (process.env.RENDER || process.env.NODE_ENV === "production" ? "shadow" : "off")
).trim().toLowerCase();
const WORLD_MODEL_SHADOW_ENABLED = !["off", "disabled"].includes(WORLD_MODEL_MODE);
const WORLD_MODEL_CONTROLS = normalizeWorldModelControls(process.env, {
  production: Boolean(process.env.RENDER || process.env.NODE_ENV === "production"),
});
const WORLD_MODEL_EXPERIENCE_TIMEOUT_MS = Math.min(50, WORLD_MODEL_CONTROLS.persistenceTimeoutMs);
const WORLD_MODEL_SESSION_HASH_SALT = String(process.env.JOZ_WORLD_MODEL_SESSION_HASH_SALT || "public-world-model");
const LEARNED_WORLD_MODEL_ENABLED = String(
  process.env.JOZ_WORLD_MODEL_LEARNED_ENABLED || "false"
).trim().toLowerCase() === "true";
const LEARNED_WORLD_MODEL_ARTIFACT_PATH = String(
  process.env.JOZ_WORLD_MODEL_ARTIFACT_PATH ||
    path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "joz", "published", "learned-world-model.json")
).trim();
const learnedWorldModel = LEARNED_WORLD_MODEL_ENABLED
  ? loadLearnedWorldModel(LEARNED_WORLD_MODEL_ARTIFACT_PATH, fs.readFileSync)
  : null;
const AR_DELIVERY_MODEL_VERSION = "ar-delivery-empirical-v1";
const AR_DELIVERY_ACTIONS = ["direct_ar", "web_preview", "qr_handoff"];
const AR_DELIVERY_PRIOR_SUCCESS = {
  direct_ar: 0.75,
  web_preview: 0.7,
  qr_handoff: 0.6,
};
const WORLD_MODEL_RECOMMENDATION_VERSION = "contextual-intro-v1";
const WORLD_MODEL_RECOMMENDATION_ACTIONS = [
  "show_skills",
  "show_neurons",
  "enter_brain",
  "explore_mindset",
];
const WORLD_MODEL_RECOMMENDATION_PRIOR_SUCCESS = {
  show_skills: 0.72,
  show_neurons: 0.58,
  enter_brain: 0.6,
  explore_mindset: 0.56,
};

function normalizeArDecisionValue(value, fallback = "unknown", maxLength = 48) {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
  return normalized || fallback;
}

function normalizeArDecisionContext(body = {}) {
  const entitySet = normalizeArDecisionValue(body.entitySet, "");
  if (!new Set(["joz_skills", "joz_neurons"]).has(entitySet)) {
    const error = new Error("AR decision requires joz_skills or joz_neurons");
    error.status = 400;
    throw error;
  }

  return {
    entitySet,
    currentPortal: normalizeArDecisionValue(body.currentPortal || body.portal, "root"),
    device: normalizeArDecisionValue(body.device, "unknown"),
    browser: normalizeArDecisionValue(body.browser, "unknown"),
    isMobile: body.isMobile === true,
    arSupported: body.arSupported === true,
    loadMs: Number.isFinite(Number(body.loadMs))
      ? Math.max(0, Math.min(120_000, Math.round(Number(body.loadMs))))
      : null,
    viewport: body.viewport && typeof body.viewport === "object"
      ? {
          width: Number(body.viewport.width) || null,
          height: Number(body.viewport.height) || null,
          pixelRatio: Number(body.viewport.pixelRatio) || null,
        }
      : {},
  };
}

function buildArDecisionStateKey(context) {
  return [
    "ar-delivery",
    context.entitySet,
    context.device,
    context.browser,
    context.arSupported ? "supported" : "unsupported",
    context.currentPortal,
  ].join(":");
}

function summarizeArDecisionExperience(rows = []) {
  return rows.reduce(
    (summary, row) => ({
      attempts: summary.attempts + Math.max(0, Number(row?.attempts) || 0),
      successes: summary.successes + Math.max(0, Number(row?.successes) || 0),
    }),
    { attempts: 0, successes: 0 }
  );
}

async function getArDecisionExperience({ stateKey, actionKey }) {
  if (isDatabaseEnabled()) {
    try {
      const rows = await withWorldModelTimeout(
        getWorldTransitionExperience({ stateKey, actionKey }),
        WORLD_MODEL_CONTROLS.persistenceTimeoutMs
      );
      if (Array.isArray(rows) && rows.length) return summarizeArDecisionExperience(rows);
    } catch (error) {
      console.warn("⚠️ AR decision experience lookup failed:", error?.message || error);
    }
  }

  return summarizeArDecisionExperience(
    worldTransitionExperienceFallbackStore.filter(
      (row) => row.state_key === stateKey && row.action_key === actionKey
    )
  );
}

function buildArDecisionCandidates(context, experiences) {
  const eligibleActions = context.isMobile && context.arSupported
    ? ["direct_ar", "web_preview"]
    : context.isMobile
      ? ["web_preview"]
      : ["qr_handoff", "web_preview"];

  return eligibleActions.map((action, index) => {
    const experience = experiences[action] || { attempts: 0, successes: 0 };
    const prior = AR_DELIVERY_PRIOR_SUCCESS[action] || 0.5;
    const posterior = (experience.successes + prior * 2) / (experience.attempts + 2);
    const loadPenalty = action === "direct_ar" && context.loadMs > 7000 ? 0.08 : 0;
    const score = Math.max(0, Math.min(1, posterior - loadPenalty));
    const confidence = experience.attempts
      ? Math.min(0.98, 0.5 + Math.min(0.45, experience.attempts / 20))
      : 0.5;

    return {
      action,
      eligible: true,
      score: Number(score.toFixed(4)),
      probability: Number(posterior.toFixed(4)),
      confidence: Number(confidence.toFixed(4)),
      attempts: experience.attempts,
      successes: experience.successes,
      reason: experience.attempts
        ? "learned from observed AR delivery outcomes"
        : "cold-start capability prior",
      priority: index,
    };
  });
}

function normalizeWorldModelRecommendationContext(body = {}) {
  return {
    currentPortal: normalizeArDecisionValue(body.currentPortal || body.portal, "root"),
    device: normalizeArDecisionValue(body.device, "unknown"),
    browser: normalizeArDecisionValue(body.browser, "unknown"),
    isMobile: body.isMobile === true,
    arSupported: body.arSupported === true,
    dayPart: normalizeArDecisionValue(body.dayPart, "unknown"),
    audience: normalizeArDecisionValue(body.audience, "explorer"),
    currentMesh: normalizeArDecisionValue(body.currentMesh, "unknown"),
    currentPhase: normalizeArDecisionValue(body.currentPhase, "unknown"),
    loadMs: Number.isFinite(Number(body.loadMs))
      ? Math.max(0, Math.min(120_000, Math.round(Number(body.loadMs))))
      : null,
  };
}

function buildWorldModelRecommendationStateKey(context) {
  return [
    "world-model-recommendation",
    context.audience,
    context.dayPart,
    context.device,
    context.arSupported ? "supported" : "unsupported",
    context.currentPortal,
  ].join(":");
}

async function getWorldModelRecommendationExperience({ stateKey, actionKey }) {
  if (isDatabaseEnabled()) {
    try {
      const rows = await withWorldModelTimeout(
        getWorldTransitionExperience({ stateKey, actionKey }),
        WORLD_MODEL_CONTROLS.persistenceTimeoutMs
      );
      if (Array.isArray(rows) && rows.length) return summarizeArDecisionExperience(rows);
    } catch (error) {
      console.warn("⚠️ Intro recommendation experience lookup failed:", error?.message || error);
    }
  }

  return summarizeArDecisionExperience(
    worldTransitionExperienceFallbackStore.filter(
      (row) => row.state_key === stateKey && row.action_key === actionKey
    )
  );
}

function scoreWorldModelRecommendation(action, context, experience) {
  const prior = WORLD_MODEL_RECOMMENDATION_PRIOR_SUCCESS[action] || 0.5;
  const posterior = (experience.successes + prior * 2) / (experience.attempts + 2);
  let score = posterior;

  if (context.audience === "business" || context.audience === "recruiter") {
    if (action === "show_skills") score += 0.2;
    if (action === "explore_mindset") score += context.audience === "recruiter" ? 0.12 : 0.04;
  }
  if (context.audience === "explorer") {
    if (action === "enter_brain" || action === "explore_mindset") score += 0.12;
  }
  if (["evening", "night"].includes(context.dayPart)) {
    if (["enter_brain", "explore_mindset"].includes(action)) score += 0.14;
    if (action === "show_neurons") score += 0.08;
  }
  if (["morning", "workday"].includes(context.dayPart) && action === "show_skills") {
    score += 0.08;
  }
  if (context.isMobile && !context.arSupported && ["enter_brain", "explore_mindset"].includes(action)) {
    score -= 0.12;
  }

  return {
    action,
    eligible: true,
    score: Number(Math.max(0, Math.min(1, score)).toFixed(4)),
    probability: Number(posterior.toFixed(4)),
    confidence: Number(
      (experience.attempts ? Math.min(0.98, 0.5 + Math.min(0.45, experience.attempts / 20)) : 0.5).toFixed(4)
    ),
    attempts: experience.attempts,
    successes: experience.successes,
    reason: experience.attempts
      ? "learned from recommendation selections"
      : "contextual cold-start prior",
  };
}

const app = express();
app.set("trust proxy", 2);
const isEphemeralFilesystem =
  process.env.VERCEL === "1" ||
  process.env.VERCEL === "true" ||
  Boolean(process.env.RENDER) ||
  process.env.DISABLE_FILE_MEMORY === "1";
const canPersistToLocalDisk = !isEphemeralFilesystem;
const canUseLocalWorldMemory = canPersistToLocalDisk && !isDatabaseRequired();
const JOZ_CHAT_SESSION_WINDOW_MS = 30_000;
const JOZ_CHAT_SESSION_MAX_REQUESTS = 5;
const JOZ_CHAT_IP_WINDOW_MS = 5 * 60_000;
const JOZ_CHAT_IP_MAX_REQUESTS = 20;
const JOZ_CHAT_DUPLICATE_WINDOW_MS = 10_000;
const DEFAULT_JOZ_CONVERSATION_RETENTION_DAYS = 30;
const DEFAULT_JOZ_CALLBACK_RETENTION_DAYS = 30;
const DEFAULT_JOZ_PRIVACY_REQUEST_RETENTION_DAYS = 365;
const BUSINESS_VALUE_DIAGNOSTIC_ENABLED = false;
const jozChatSessionLog = new Map();
const jozChatIpLog = new Map();
const jozChatDuplicateLog = new Map();
const jozCallbackFallbackStore = [];
const jozObservabilityFallbackStore = [];
const worldModelTrajectoryFallbackStore = [];
const worldTransitionExperienceFallbackStore = [];
const worldModelPredictionFallbackStore = new Map();
const jozRecentSessionMessagesFallbackStore = new Map();
const jozBusinessValueCaseFallbackStore = new Map();
const isNodeTestRuntime =
  process.argv.includes("--test") || process.execArgv.includes("--test");

function parseRetentionDays(value, fallbackDays) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackDays;
}

const JOZ_CONVERSATION_RETENTION_DAYS = parseRetentionDays(
  process.env.JOZ_CONVERSATION_RETENTION_DAYS,
  DEFAULT_JOZ_CONVERSATION_RETENTION_DAYS
);
const JOZ_CALLBACK_RETENTION_DAYS = parseRetentionDays(
  process.env.JOZ_CALLBACK_RETENTION_DAYS,
  DEFAULT_JOZ_CALLBACK_RETENTION_DAYS
);
const JOZ_PRIVACY_REQUEST_RETENTION_DAYS = parseRetentionDays(
  process.env.JOZ_PRIVACY_REQUEST_RETENTION_DAYS,
  DEFAULT_JOZ_PRIVACY_REQUEST_RETENTION_DAYS
);
const JOZ_WORLD_MODEL_RETENTION_DAYS = parseRetentionDays(
  process.env.JOZ_WORLD_MODEL_RETENTION_DAYS,
  WORLD_MODEL_CONTROLS.retentionDays
);

function pseudonymizeWorldModelSession(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return createHash("sha256")
    .update(`${WORLD_MODEL_SESSION_HASH_SALT}:${raw}`)
    .digest("hex")
    .slice(0, 32);
}

function withWorldModelTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function normalizeJozChatMessage(text = "") {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getFallbackRecentJozSessionMessages({ sessionKey = null, limit = 12 } = {}) {
  const key = String(sessionKey || "").trim();
  if (!key) return [];
  const messages = jozRecentSessionMessagesFallbackStore.get(key) || [];
  return messages.slice(-Math.max(1, limit)).map((message) => ({
    role: message?.role === "assistant" ? "assistant" : "user",
    content: String(message?.content || ""),
    metadata: message?.metadata && typeof message.metadata === "object" ? message.metadata : {},
  }));
}

function appendFallbackRecentJozSessionMessage({
  sessionKey = null,
  role = "user",
  content = "",
  metadata = {},
} = {}) {
  const key = String(sessionKey || "").trim();
  const text = String(content || "").trim();
  if (!key || !text) return;

  const existing = jozRecentSessionMessagesFallbackStore.get(key) || [];
  existing.push({
    role: role === "assistant" ? "assistant" : "user",
    content: text,
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  });
  jozRecentSessionMessagesFallbackStore.set(key, existing.slice(-24));
}

function getBusinessValueCaseFallbackKey({ sessionKey = null, conversationId = null } = {}) {
  return String(sessionKey || conversationId || "anonymous").trim() || "anonymous";
}

function inferBusinessValueCaseEventType(previousState = null, nextState = {}) {
  if (!previousState) return "case_opened";
  if (nextState.status === "verified" && previousState.status !== "verified") {
    return "diagnosis_verified";
  }
  if (
    nextState.approval?.status === "approved" &&
    previousState.approval?.status !== "approved"
  ) {
    return "approval_received";
  }
  if (Number(nextState.evidenceCoverage || 0) > Number(previousState.evidenceCoverage || 0)) {
    return "evidence_added";
  }
  return "diagnosis_updated";
}

async function persistBusinessValueDiagnosticCase({
  state,
  conversationId = null,
  sessionKey = null,
  companyKey = null,
  evidenceRecords = [],
} = {}) {
  if (!state) return null;

  const fallbackKey = getBusinessValueCaseFallbackKey({ sessionKey, conversationId });
  const previous = jozBusinessValueCaseFallbackStore.get(fallbackKey) || null;
  const persisted = await upsertBusinessValueCase({
    caseId: previous?.caseId || null,
    conversationId,
    sessionKey,
    companyKey,
    state,
  });
  const caseId =
    persisted?.id ||
    previous?.caseId ||
    `memory-business-value-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const eventType = inferBusinessValueCaseEventType(previous?.state || null, state);
  const event = {
    id: `memory-business-value-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    case_id: caseId,
    event_type: eventType,
    actor: "joz_llm",
    payload: {
      activeNode: state.activeNode,
      status: state.status,
      evidenceCoverage: state.evidenceCoverage,
    },
    created_at: new Date().toISOString(),
  };
  const events = [...(previous?.events || []), event].slice(-100);
  if (persisted?.id) {
    const databaseEvent = await appendBusinessValueCaseEvent({
      caseId: persisted.id,
      eventType,
      payload: event.payload,
    });
    if (databaseEvent) events[events.length - 1] = databaseEvent;
  }

  const record = {
    caseId,
    conversationId,
    sessionKey,
    companyKey,
    state: { ...state, caseId },
    evidenceRecords: dedupeBusinessValueEvidence(evidenceRecords),
    events,
    storage: persisted?.id ? "database" : "memory",
    updatedAt: new Date().toISOString(),
  };
  jozBusinessValueCaseFallbackStore.set(fallbackKey, record);
  return record;
}

function pruneRecentTimestamps(timestamps = [], windowMs, now) {
  return timestamps.filter((timestamp) => now - timestamp < windowMs);
}

function trackJozChatWindow(store, key, windowMs, now) {
  const recent = pruneRecentTimestamps(store.get(key) || [], windowMs, now);
  recent.push(now);
  store.set(key, recent);
  return recent;
}

function getClientIp(req) {
  const cloudflareIp = String(req.headers["cf-connecting-ip"] || "").trim();
  const isCloudflareRequest = Boolean(String(req.headers["cf-ray"] || "").trim());

  return (
    (isCloudflareRequest && cloudflareIp) ||
    String(req.ips?.[0] || "").trim() ||
    String(req.ip || "").trim() ||
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    String(req.socket?.remoteAddress || "").trim() ||
    "unknown"
  );
}

function enforceJozChatRateLimit(req, sessionKey, latestUserMessage) {
  if (process.env.NODE_ENV !== "production" || isNodeTestRuntime) return null;

  const now = Date.now();
  const ip = getClientIp(req);
  const normalizedMessage = normalizeJozChatMessage(latestUserMessage);
  const sessionIdentifier = sessionKey || `ip:${ip}`;

  const sessionEvents = trackJozChatWindow(
    jozChatSessionLog,
    sessionIdentifier,
    JOZ_CHAT_SESSION_WINDOW_MS,
    now
  );
  if (sessionEvents.length > JOZ_CHAT_SESSION_MAX_REQUESTS) {
    return {
      status: 429,
      error: "Too many messages in this session. Please wait a moment.",
      retryAfterMs: JOZ_CHAT_SESSION_WINDOW_MS,
    };
  }

  const ipEvents = trackJozChatWindow(
    jozChatIpLog,
    ip,
    JOZ_CHAT_IP_WINDOW_MS,
    now
  );
  if (ipEvents.length > JOZ_CHAT_IP_MAX_REQUESTS) {
    return {
      status: 429,
      error: "Too many requests from this IP. Please wait a moment.",
      retryAfterMs: JOZ_CHAT_IP_WINDOW_MS,
    };
  }

  if (normalizedMessage) {
    const duplicateKey = `${sessionIdentifier}:${normalizedMessage}`;
    const lastDuplicateTimestamp = jozChatDuplicateLog.get(duplicateKey) || 0;
    if (now - lastDuplicateTimestamp < JOZ_CHAT_DUPLICATE_WINDOW_MS) {
      return {
        status: 429,
        error: "Duplicate message sent too quickly. Please wait before retrying.",
        retryAfterMs: JOZ_CHAT_DUPLICATE_WINDOW_MS,
      };
    }
    jozChatDuplicateLog.set(duplicateKey, now);
  }

  return null;
}

const configuredAllowedOrigins = String(process.env.JOZ_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  "https://meetjoz.com",
  "https://www.meetjoz.com",
  ...configuredAllowedOrigins,
  ...(process.env.NODE_ENV === "production"
    ? []
    : ["http://localhost:3000", "http://127.0.0.1:3000"]),
]);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=(self)");
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("Origin is not allowed"));
    },
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    exposedHeaders: ["X-Request-ID", "X-AI-Interaction", "X-AI-System-Card"],
    credentials: false,
  })
);
app.use(express.json({ limit: "12mb" }));

// --- Test route ---
app.get("/api/hello", (req, res) => {
  res.json({
    message: "Backend is connected and running!",
    buildId: JOZ_BUILD_ID,
    routerVersion: JOZ_ROUTER_VERSION,
    modelRuntime,
    worldModel: {
      mode: WORLD_MODEL_MODE,
      enabled: WORLD_MODEL_SHADOW_ENABLED,
      modelVersion: WORLD_MODEL_VERSION,
      transitionRuleVersion: WORLD_TRANSITION_RULE_VERSION,
      executionPolicy: "existing_guardrails_execute_approved_action",
    },
  });
});

app.get("/api/world-model/status", (_req, res) => {
  res.json({
    ok: true,
    enabled: WORLD_MODEL_SHADOW_ENABLED,
    mode: WORLD_MODEL_MODE,
    modelVersion: WORLD_MODEL_VERSION,
    transitionRuleVersion: WORLD_TRANSITION_RULE_VERSION,
    sampling: {
      rate: WORLD_MODEL_CONTROLS.sampleRate,
      excludeDevelopment: WORLD_MODEL_CONTROLS.excludeDevelopment,
    },
    controls: {
      maxCandidates: WORLD_MODEL_CONTROLS.maxCandidates,
      maxRolloutDepth: WORLD_MODEL_CONTROLS.maxRolloutDepth,
      maxTrajectoryBytes: WORLD_MODEL_CONTROLS.maxTrajectoryBytes,
      persistenceTimeoutMs: WORLD_MODEL_CONTROLS.persistenceTimeoutMs,
      retentionDays: WORLD_MODEL_CONTROLS.retentionDays,
    },
    executionPolicy: "shadow_predictions_do_not_control_live_actions",
    observationBoundary: "structured_application_scene_state; no_continuous_camera_audio_or_biometrics",
    persistence: isDatabaseEnabled() ? "postgresql" : "memory_fallback",
    learnedTransitionModel: {
      enabled: LEARNED_WORLD_MODEL_ENABLED,
      loaded: Boolean(learnedWorldModel),
      modelVersion: learnedWorldModel?.modelVersion || null,
      trainingExamples: learnedWorldModel?.training?.trainingExamples || 0,
      transitionCount: learnedWorldModel?.training?.transitionCount || 0,
    },
  });
});

app.post("/api/world-model/ar-decision", async (req, res) => {
  try {
    const context = normalizeArDecisionContext(req.body || {});
    const stateKey = buildArDecisionStateKey(context);
    const experiences = Object.fromEntries(
      await Promise.all(
        AR_DELIVERY_ACTIONS.map(async (action) => [
          action,
          await getArDecisionExperience({ stateKey, actionKey: action }),
        ])
      )
    );
    const candidates = buildArDecisionCandidates(context, experiences);
    const selected = candidates
      .slice()
      .sort((left, right) => right.score - left.score || left.priority - right.priority)[0];
    const decisionId = randomUUID();
    const totalAttempts = candidates.reduce((sum, candidate) => sum + candidate.attempts, 0);

    return res.json({
      ok: true,
      decisionId,
      trajectoryId: `ar-delivery-${decisionId}`,
      modelVersion: AR_DELIVERY_MODEL_VERSION,
      entitySet: context.entitySet,
      stateKey,
      selectedAction: selected.action,
      confidence: selected.confidence,
      source: totalAttempts ? "observed_trajectory_experience" : "cold_start_prior",
      context,
      candidates: candidates.map(({ priority, ...candidate }) => candidate),
      executionPolicy: "allowlisted_delivery_path_with_observed_outcomes",
    });
  } catch (error) {
    console.error("❌ /api/world-model/ar-decision failed:", error?.message || error);
    return res.status(error.status || 400).json({ error: error.message });
  }
});

app.post("/api/world-model/recommendations", async (req, res) => {
  try {
    const context = normalizeWorldModelRecommendationContext(req.body || {});
    const stateKey = buildWorldModelRecommendationStateKey(context);
    const experiences = Object.fromEntries(
      await Promise.all(
        WORLD_MODEL_RECOMMENDATION_ACTIONS.map(async (action) => [
          action,
          await getWorldModelRecommendationExperience({ stateKey, actionKey: action }),
        ])
      )
    );
    const candidates = WORLD_MODEL_RECOMMENDATION_ACTIONS
      .map((action) => scoreWorldModelRecommendation(action, context, experiences[action]))
      .sort((left, right) => right.score - left.score ||
        WORLD_MODEL_RECOMMENDATION_ACTIONS.indexOf(left.action) -
        WORLD_MODEL_RECOMMENDATION_ACTIONS.indexOf(right.action));
    const selectedActions = candidates
      .filter((candidate) => ["show_skills", "show_neurons"].includes(candidate.action))
      .slice(0, 2)
      .map((candidate) => candidate.action);
    const totalAttempts = candidates.reduce((sum, candidate) => sum + candidate.attempts, 0);

    return res.json({
      ok: true,
      recommendationId: randomUUID(),
      modelVersion: WORLD_MODEL_RECOMMENDATION_VERSION,
      source: totalAttempts ? "observed_recommendation_experience" : "contextual_cold_start",
      context,
      stateKey,
      selectedActions,
      candidates,
      executionPolicy: "allowlisted_contextual_intro_actions",
    });
  } catch (error) {
    console.error("❌ /api/world-model/recommendations failed:", error?.message || error);
    return res.status(error.status || 400).json({ error: error.message });
  }
});

app.get("/api/version", (req, res) => {
  res.json({
    buildId: JOZ_BUILD_ID,
    routerVersion: JOZ_ROUTER_VERSION,
    environment: process.env.NODE_ENV || "development",
    modelRuntime,
  });
});

app.get("/api/ai-system-card", (_req, res) => {
  res.json({
    ok: true,
    ...JOZ_AI_SYSTEM_CARD,
    aiDisclosure: AI_MACHINE_READABLE_DISCLOSURE,
    aiDisclosureText: AI_DISCLOSURE_TEXT,
    governanceVersion: AI_ACT_GOVERNANCE_VERSION,
    aiActReadiness: "engineering-safeguards-implemented-legal-review-required",
  });
});

app.post("/api/ai-compliance/incidents", requireJozAuth, async (req, res) => {
  const category = String(req.body?.category || "safety_or_compliance_concern").trim().slice(0, 120);
  const severity = String(req.body?.severity || "medium").trim().toLowerCase();
  const description = redactJozFixtureText(req.body?.description || "");
  const containment = redactJozFixtureText(req.body?.containment || "");
  if (!description || description.length < 10) {
    return res.status(400).json({ error: "Please provide a description of at least 10 characters." });
  }
  if (!["low", "medium", "high", "critical"].includes(severity)) {
    return res.status(400).json({ error: "Unsupported incident severity." });
  }

  try {
    const incident = await createJozAIComplianceIncident({
      companyKey: req.jozAuth?.companyKey || null,
      reporterId: req.jozAuth?.userId || "authenticated_user",
      category,
      severity,
      description,
      containment: containment || null,
    });
    return res.status(201).json({
      ok: true,
      incident: incident || {
        status: "open",
        category,
        severity,
        description,
        containment: containment || null,
        storage: "database_unavailable",
      },
      nextStep: "Stop relying on the affected output, preserve relevant evidence, and contact joz@meetjoz.com for triage.",
    });
  } catch (error) {
    console.error("❌ AI compliance incident creation failed:", error);
    return res.status(500).json({ error: "Could not register the compliance incident." });
  }
});

app.get("/api/joz-data/overview", async (req, res) => {
  try {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const manifestPath = path.join(repoRoot, "data", "joz", "published", "joz-dataset-manifest.json");
    const bundlePath = path.join(repoRoot, "data", "joz", "published", "joz-documents.generated.json");
    const manifest = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
      : {};
    const bundle = fs.existsSync(bundlePath)
      ? JSON.parse(fs.readFileSync(bundlePath, "utf8"))
      : {};
    const localRecords = Array.isArray(bundle?.records) ? bundle.records : [];
    const evidenceTiers = {};
    for (const record of localRecords) {
      const tier = record?.metadata?.evidence_tier || "unverified";
      evidenceTiers[tier] = (evidenceTiers[tier] || 0) + 1;
    }

    return res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      local: {
        manifest,
        recordCount: localRecords.length,
        modelReadyCount: Array.isArray(bundle?.model_ready_records) ? bundle.model_ready_records.length : 0,
        evidenceTiers,
        sources: Array.isArray(manifest?.sources) ? manifest.sources : [],
      },
      runtime: {
        databaseEnabled: isDatabaseEnabled(),
        databaseRequired: isDatabaseRequired(),
        source: isDatabaseRequired()
          ? "supabase_postgres"
          : isDatabaseEnabled()
            ? "supabase_postgres_plus_local_build_artifact"
            : "local_file_memory",
        localFallbackEnabled: !isDatabaseRequired(),
      },
      modelRuntime,
      supabase: await getJozDataControlOverview(),
    });
  } catch (error) {
    console.error("❌ /api/joz-data/overview failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

// === FILE PERSISTENCE SETUP ===
const MEMORY_FILE = path.resolve("./worldMemory.json");
let worldMemory = {};
let worldMap = {};

// 🔹 Load memory
try {
  if (canUseLocalWorldMemory && fs.existsSync(MEMORY_FILE)) {
    const raw = fs.readFileSync(MEMORY_FILE, "utf8");
    worldMemory = JSON.parse(raw);
    console.log(`💾 Loaded ${Object.keys(worldMemory).length} worldMemory objects`);
  } else if (canUseLocalWorldMemory) {
    console.log("🆕 No existing world memory, starting fresh");
  } else {
    console.log("💾 Local world memory disabled; database control plane is authoritative");
  }
} catch (err) {
  console.error("⚠️ Failed to load world memory:", err);
}

// 🔹 Save helper
function saveWorldMemory() {
  if (!canUseLocalWorldMemory) {
    console.log("💾 Skipping worldMemory save; database control plane is authoritative");
    return;
  }

  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(worldMemory, null, 2));
    console.log("💾 World memory saved locally.");
  } catch (err) {
    console.error("❌ Failed to save memory:", err);
  }
}

// ------------------------------------------------------------
// 1️⃣ World Map Updates
// ------------------------------------------------------------
app.post("/api/world-map", (req, res) => {
  if (!canUseLocalWorldMemory) {
    return res.status(503).json({
      error: "Database-backed world state is required; local world-memory writes are disabled.",
    });
  }
  worldMap = req.body.worldMap || {};
  mergeWorldMapIntoMemory(worldMap);
  if (canPersistToLocalDisk) saveWorldMemory();
  console.log("🌍 Updated worldMap with", Object.keys(worldMap).length, "entries");
  res.json({ success: true });
});

app.get("/api/world-map", (req, res) => {
  if (!canUseLocalWorldMemory) {
    return res.status(503).json({
      error: "Database-backed world state is required; local world-memory reads are disabled.",
    });
  }
  return res.json(worldMap);
});

// ------------------------------------------------------------
// 2️⃣ World Memory Storage
// ------------------------------------------------------------
app.post("/api/world-memory", (req, res) => {
  if (!canUseLocalWorldMemory) {
    return res.status(503).json({
      error: "Database-backed world state is required; local world-memory writes are disabled.",
    });
  }
  const { mesh, action, context, commands = [] } = req.body;
  if (!mesh) return res.status(400).json({ error: "Missing mesh name" });

  if (!worldMemory[mesh]) {
    worldMemory[mesh] = {
      action: action || "defined",
      context: context || {},
      commands: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  const existing = new Set(worldMemory[mesh].commands);
  commands.forEach((cmd) => existing.add(cmd.toLowerCase().trim()));

  worldMemory[mesh] = {
    ...worldMemory[mesh],
    commands: Array.from(existing),
    action: action || worldMemory[mesh].action,
    context: { ...worldMemory[mesh].context, ...context },
    lastUpdated: new Date().toISOString(),
  };

  if (canPersistToLocalDisk) saveWorldMemory();
  console.log(`🌍 Learned about "${mesh}" →`, worldMemory[mesh]);
  res.json({ success: true, memory: worldMemory });
});

app.get("/api/world-memory", (req, res) => {
  if (!canUseLocalWorldMemory) {
    return res.status(503).json({
      error: "Database-backed world state is required; local world-memory reads are disabled.",
    });
  }
  return res.json(worldMemory);
});

app.post("/api/agentic", async (req, res) => {
  try {
    const input = String(req.body?.input || req.body?.transcript || "").trim();
    const context = req.body?.context || {};
    const appContext = req.body?.app_context || context?.app_context || {};
    const currentPortal = context?.currentPortal || context?.portal || "root";
    const structuredPortalKey = currentPortal === "maxx" ? "the-vibe-energy" : currentPortal;
    const currentStateKey = inferStructuredStateKey(currentPortal, context?.currentMesh || context?.mesh || null);
    const structuredState = currentStateKey ? await getStructuredWorldState(structuredPortalKey, currentStateKey) : null;

    if (!input) {
      return res.status(400).json({ error: "Missing input" });
    }

    const enrichedContext = {
      ...context,
      app_context: appContext,
      structuredState,
      structuredAvailableActions: structuredState?.availableActions || [],
      allowedActions: context?.allowedActions || structuredState?.availableActions || [],
      knownInteractiveMeshes:
        context?.knownInteractiveMeshes ||
        structuredState?.objects?.map((entry) => entry.mesh).filter(Boolean) ||
        [],
    };
    const snapshot = buildAgentSnapshot({ input, context: enrichedContext, worldMap, worldMemory });
    const initialWorldState = WORLD_MODEL_SHADOW_ENABLED
      ? buildCanonicalWorldState({
          appContext: snapshot.validatedAppContext,
          legacyContext: enrichedContext,
          structuredState,
          userContext: context?.userContext || context?.user_context || {},
        })
      : null;
    const initialObservation = WORLD_MODEL_SHADOW_ENABLED
      ? context?.worldObservation
        ? observeWorld(context.worldObservation)
        : observeWorld({
            symbolicState: initialWorldState,
            sceneState: {
              sceneId: initialWorldState.portal,
              activePortal: initialWorldState.portal,
              activeStage: initialWorldState.stage,
              focusedEntityId: initialWorldState.focusedEntityId,
              visibleObjectIds: initialWorldState.visibleEntityIds,
              visibleMeshIds: initialWorldState.visibleEntityIds,
            },
            cameraState: initialWorldState.environment?.camera,
            overlays: { activeIds: initialWorldState.environment?.activeOverlays },
            missingFields: [
              "sceneState.objectTransforms",
              "cameraState.projection",
              "spatialRelationships",
              "arMetadata.anchorIds",
            ],
            fieldSupport: {
              sceneState: "derived",
              visibleObjectIds: initialWorldState.visibleEntityIds?.length ? "derived" : "unknown",
              objectTransforms: "unknown",
              cameraState: "unknown",
              spatialRelationships: "unknown",
              arMetadata: "unknown",
            },
          })
      : null;
    const predictionTraceId = randomUUID();
    const rawPredictionSessionId =
      String(context?.sessionKey || context?.session_key || context?.conversationId || "").trim() || null;
    const predictionSessionId = pseudonymizeWorldModelSession(rawPredictionSessionId);
    const worldModelSampled = WORLD_MODEL_SHADOW_ENABLED &&
      !WORLD_MODEL_CONTROLS.excludeDevelopment &&
      !isLikelyWorldModelBot(req.headers["user-agent"]) &&
      shouldSampleWorldTrajectory(predictionTraceId, WORLD_MODEL_CONTROLS.sampleRate);
    const canonicalWorldReply = buildMeetJozWorldAwarenessReply({
      input,
      appContext: snapshot.validatedAppContext,
      legacyContext: snapshot,
    });
    let proposal = null;

    if (isJozModelGatewayAvailable(openai)) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are a world-aware agent for a 3D interactive portfolio. Return only JSON with keys intent, response, proposedAction, proposedTarget, confidence. Do not propose actions outside the current world's legal actions unless it is a contact or call utility action.",
            },
            {
              role: "user",
              content: JSON.stringify(snapshot),
            },
          ],
        });

        const content = response.choices?.[0]?.message?.content?.trim() || "{}";
        proposal = JSON.parse(content);
      } catch (error) {
        console.error("⚠️ /api/agentic model call failed:", error?.message || error);
      }
    }

    const clean = snapshot.normalizedInput;
    const approved = approveAgentProposal({ clean, context: snapshot, worldMap, worldMemory, proposal });
    let predictionTrace = null;
    const shadowPredictionPromise = new Promise((resolve) => {
      setImmediate(() => {
        (async () => {
    try {
    if (WORLD_MODEL_SHADOW_ENABLED && worldModelSampled) {
    const predictionStartedAt = Date.now();
    const predictiveActions = [
      ...new Set([
        ...snapshot.allowedActions,
        ...snapshot.validatedAppContext.available_actions,
        ...(snapshot.structuredState?.availableActions || []),
        approved?.action || null,
      ].map((value) => String(value || "").trim()).filter(Boolean)),
    ].slice(0, WORLD_MODEL_CONTROLS.maxCandidates);
    const predictionCandidates = predictiveActions.map((action) => ({
      actions: [
        approved?.action === action && approved?.target
          ? { type: action, target: approved.target }
          : action,
      ],
      transitions: snapshot.structuredState?.transitions || [],
    }));
    const experienceByAction = {};
    if (WORLD_MODEL_SHADOW_ENABLED && worldModelSampled) {
      await Promise.all(predictiveActions.map(async (action) => {
        try {
          const lookup = isDatabaseEnabled()
            ? getWorldTransitionExperience({
                stateKey: initialWorldState.currentStateKey,
                actionKey: action,
              })
            : Promise.resolve(getFallbackWorldTransitionExperience({
                stateKey: initialWorldState.currentStateKey,
                actionKey: action,
              }));
          experienceByAction[action] = await Promise.race([
            lookup,
            new Promise((resolve) => setTimeout(() => resolve([]), WORLD_MODEL_EXPERIENCE_TIMEOUT_MS)),
          ]);
        } catch (error) {
          console.warn("⚠️ World experience lookup failed; using symbolic fallback:", error?.message || error);
          experienceByAction[action] = [];
        }
      }));
    }
    const evaluatedPredictionCandidates = evaluateWorldPlans(
      initialWorldState,
      predictionCandidates,
      input,
    );
    for (const candidate of evaluatedPredictionCandidates) {
      const action = candidate.plan?.actions?.[0] || null;
      candidate.predictedObservation = predictObservation(
        initialObservation,
        action,
        candidate.simulation.predictedState,
        {
          expectedEffects: candidate.simulation.trajectory?.flatMap((step) => step.expectedEffects || []) || [],
          confidence: candidate.score?.confidence,
          portalSceneManifest: context?.portalSceneManifest || structuredState?.portalSceneManifest,
          sourceVersions: initialObservation.sourceVersions,
        },
      );
    }
    const plannerSelectedPrediction = chooseWorldPlan(
      initialWorldState,
      predictionCandidates,
      input,
    );
    const evaluatedProbabilisticCandidates = WORLD_MODEL_SHADOW_ENABLED
      ? evaluateProbabilisticPlans(
          initialWorldState,
          predictionCandidates,
          input,
          {
            transitions: snapshot.structuredState?.transitions || [],
            experienceByAction,
        maxDepth: WORLD_MODEL_CONTROLS.maxRolloutDepth,
          },
        )
      : [];
    for (const candidate of evaluatedProbabilisticCandidates) {
      const action = candidate.plan?.actions?.[0] || null;
      candidate.predictedObservation = predictObservation(
        initialObservation,
        action,
        candidate.probabilisticSimulation.predictedState,
        {
          expectedEffects: candidate.probabilisticSimulation.trajectory?.flatMap((step) => step.expectedEffects || []) || [],
          confidence: candidate.probabilisticSimulation.trajectory?.[0]?.confidence,
          successProbability: candidate.probabilisticSimulation.successProbability,
          portalSceneManifest: context?.portalSceneManifest || structuredState?.portalSceneManifest,
          sourceVersions: initialObservation.sourceVersions,
        },
      );
    }
    const learnedPredictionCandidates = LEARNED_WORLD_MODEL_ENABLED && learnedWorldModel
      ? predictiveActions.flatMap((action) =>
          predictLearnedNextStates(learnedWorldModel, initialWorldState, action, { topK: 3 })
            .map((prediction) => ({
              action,
              ...prediction,
            }))
        )
      : [];
    const approvedPrediction = approved?.action
      ? evaluatedPredictionCandidates.find((candidate) => {
          const candidateAction = candidate.plan?.actions?.[0];
          const candidateType = typeof candidateAction === "string"
            ? candidateAction
            : candidateAction?.type || candidateAction?.action;
          return String(candidateType || "").trim() === String(approved.action).trim();
        })
      : null;
    const selectedPrediction = approvedPrediction || evaluatedPredictionCandidates
      .filter((candidate) => candidate.simulation.valid)
      .sort((left, right) => right.score.total - left.score.total)[0] || null;
    const approvedProbabilisticPrediction = approved?.action
      ? evaluatedProbabilisticCandidates.find((candidate) => {
          const candidateAction = candidate.plan?.actions?.[0];
          const candidateType = typeof candidateAction === "string"
            ? candidateAction
            : candidateAction?.type || candidateAction?.action;
          return String(candidateType || "").trim() === String(approved.action).trim();
        })
      : null;
    const selectedProbabilisticPrediction = approvedProbabilisticPrediction || evaluatedProbabilisticCandidates
      .filter((candidate) => candidate.probabilisticSimulation.valid)
      .sort((left, right) => right.score.total - left.score.total)[0] || null;
    const plannerSelectedProbabilisticPrediction = evaluatedProbabilisticCandidates
      .filter((candidate) => candidate.probabilisticSimulation.valid)
      .sort((left, right) => right.score.total - left.score.total)[0] || null;
    predictionTrace = buildPredictionTrace({
      input,
      trajectoryId: predictionTraceId,
      sessionId: predictionSessionId,
      traceId: predictionTraceId,
      interactionChannel: "voice",
      goal: "world_navigation",
      modelVersion: WORLD_MODEL_VERSION,
      transitionRuleVersion: WORLD_TRANSITION_RULE_VERSION,
      initialState: initialWorldState,
      candidatePlans: evaluatedPredictionCandidates,
      selectedPlan: selectedPrediction,
      plannerSelectedPlan: plannerSelectedPrediction,
      probabilisticCandidates: evaluatedProbabilisticCandidates,
      probabilisticSelected: selectedProbabilisticPrediction,
      probabilisticPlannerSelected: plannerSelectedProbabilisticPrediction,
      observationBefore: initialObservation,
      shadowLatencyMs: Date.now() - predictionStartedAt,
      learnedTransitionModel: {
        enabled: LEARNED_WORLD_MODEL_ENABLED,
        loaded: Boolean(learnedWorldModel),
        modelVersion: learnedWorldModel?.modelVersion || null,
        candidates: learnedPredictionCandidates,
      },
    });
    }
    } catch (error) {
      console.warn("⚠️ Shadow world-model prediction failed; continuing with approved action:", error?.message || error);
      predictionTrace = null;
    }
    return predictionTrace;
        })().then(resolve);
      });
    });
    const reply =
      canonicalWorldReply ||
      approved?.awareness ||
      proposal?.response ||
      buildFallbackAgentReply({ approved, snapshot });
    const trace = buildWorldAwarenessTrace({
      input,
      appContext: snapshot.validatedAppContext,
      legacyContext: snapshot,
      answerSource: canonicalWorldReply
        ? "root_gold_pill / gold_pill concept"
        : approved?.awareness
          ? approved?.source || "deterministic"
          : proposal?.response
            ? "llm_proposal"
            : "llm_fallback",
    });
    logWorldAwarenessTrace("/api/agentic", {
      ...trace,
      prediction: {
        mode: WORLD_MODEL_SHADOW_ENABLED ? "shadow" : "disabled",
        sampled: worldModelSampled,
        candidateCount: predictionTrace?.candidateCount || 0,
        selectedActions: predictionTrace?.selected?.actions || [],
        predictionError: predictionTrace?.predictionError || null,
      },
    });

    const response = res.json({
      intent:
        String(
          canonicalWorldReply
            ? "world_awareness"
            : proposal?.intent || approved?.action || ""
        ).trim() || "noop",
      response: reply,
      params: {
        action: approved?.action || null,
        target: approved?.target || null,
        awareness: canonicalWorldReply || approved?.awareness || null,
        source:
          canonicalWorldReply
            ? "world_awareness"
            : approved?.source || "agent_noop",
      },
      approvedAction: approved?.action || null,
      approvedTarget: approved?.target || null,
      approvedAwareness: canonicalWorldReply || approved?.awareness || null,
      prediction: {
        ...(predictionTrace || {}),
        trajectoryId: predictionTrace?.trajectoryId || predictionTraceId,
        traceId: predictionTrace?.traceId || predictionTraceId,
        sessionId: predictionTrace?.sessionId || predictionSessionId,
        initialState: predictionTrace?.initialState || initialWorldState,
        observationBefore: predictionTrace?.observationBefore || initialObservation,
        goal: predictionTrace?.goal || "world_navigation",
        interactionChannel: predictionTrace?.interactionChannel || "voice",
        recordedAt: new Date().toISOString(),
        pending: WORLD_MODEL_SHADOW_ENABLED && worldModelSampled && !predictionTrace,
        mode: WORLD_MODEL_SHADOW_ENABLED ? "shadow" : "disabled",
        sampled: worldModelSampled,
        approvedAction: approved?.action || null,
        approvedTarget: approved?.target || null,
        executionPolicy: "existing_guardrails_execute_approved_action",
      },
      snapshot,
      trace,
    });
    void shadowPredictionPromise
      .then((completedPrediction) => {
        if (!completedPrediction) return null;
        rememberCompletedWorldModelPrediction({
          prediction: completedPrediction,
          approved,
        });
        return persistCompletedWorldModelPrediction({
          prediction: completedPrediction,
          approved,
          sampleRate: WORLD_MODEL_CONTROLS.sampleRate,
        });
      })
      .catch((error) => {
        console.warn("⚠️ Deferred shadow persistence failed:", error?.message || error);
      });
    return response;
  } catch (error) {
    console.error("❌ /api/agentic failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/world-model/predictions/:trajectoryId", (req, res) => {
  const trajectoryId = String(req.params.trajectoryId || "").trim();
  const prediction = worldModelPredictionFallbackStore.get(trajectoryId);
  if (!prediction) {
    return res.status(202).json({ ready: false, trajectoryId });
  }
  return res.json({ ready: true, prediction });
});

app.post("/api/world-model/trajectories", async (req, res) => {
  try {
    if (!WORLD_MODEL_SHADOW_ENABLED) {
      return res.status(204).end();
    }
    const body = req.body || {};
    if (Buffer.byteLength(JSON.stringify(body)) > WORLD_MODEL_CONTROLS.maxTrajectoryBytes) {
      return res.status(413).json({ error: "World-model trajectory payload exceeds shadow limit" });
    }
    const classification = classifyWorldTrajectory({
      hasPrediction: Boolean(body.symbolicPrediction || body.predictedObservation),
      hasObservation: Boolean(body.observedObservation || body.observedState),
      observationCaptureFailed: body.observationCaptureFailed === true,
      predictionFailed: body.predictionFailed === true,
      invalidAction: Boolean(body.symbolicPrediction?.violations?.length),
      unsupportedOnly: Boolean(
        body.observationDifference?.metrics?.unknownFieldCount > 0 &&
        !body.observationDifference?.metrics?.criticalMismatchCount
      ),
      interrupted: body.interrupted === true,
      isTest: body.isTest === true,
      isSynthetic: body.isSynthetic === true,
    });
    const record = buildWorldTrajectoryRecord({
      trajectoryId: body.trajectoryId || randomUUID(),
      sessionId: pseudonymizeWorldModelSession(body.sessionId),
      traceId: body.traceId || body.trajectoryId || null,
      stateBefore: body.stateBefore || {},
      stateHistory: body.stateHistory || [],
      proposedAction: body.proposedAction || null,
      symbolicPrediction: body.symbolicPrediction || null,
      probabilisticPrediction: body.probabilisticPrediction || null,
      expectedEffects: body.expectedEffects || [],
      observationBefore: body.observationBefore || null,
      predictedObservation: body.predictedObservation || null,
      observedObservation: body.observedObservation || null,
      observationDifference: body.observationDifference || null,
      observationSourceVersions: body.observationSourceVersions || {},
      observedState: body.observedState || null,
      observedEffects: body.observedEffects || [],
      intent: body.intent || "spatial_navigation",
      goal: body.goal || "world_navigation",
      interactionChannel: body.interactionChannel || "unknown",
      transitionDurationMs: body.transitionDurationMs,
      success: body.success,
      predictionDifferences: body.predictionDifferences || null,
      confidenceBeforeAction: body.confidenceBeforeAction,
      outcomeScores: body.outcomeScores || {},
      modelVersion: body.modelVersion || WORLD_MODEL_VERSION,
      transitionRuleVersion: body.transitionRuleVersion || WORLD_TRANSITION_RULE_VERSION,
      shadowLatencyMs: body.shadowLatencyMs,
      worldModelMode: WORLD_MODEL_MODE,
      plannerSelectedAction: body.plannerSelectedAction || body.plannerSelected?.actions?.[0] || null,
      deterministicApprovedAction: body.deterministicApprovedAction || null,
      candidatePlans: body.candidatePlans || body.candidates || [],
      expectedObservedEffects: body.expectedObservedEffects || null,
      fieldSupport: body.fieldSupport || body.observedObservation?.fieldSupport || {},
      classification: classification.classification,
      failureCategory: classification.failureCategory,
      persistenceStatus: "pending",
      predictionLatencyMs: body.predictionLatencyMs || body.shadowLatencyMs,
      observationLatencyMs: body.observationLatencyMs,
      sampleRate: WORLD_MODEL_CONTROLS.sampleRate,
      sampled: body.sampled !== false,
      consentCompatible: body.consentCompatible !== false,
      isTest: body.isTest === true,
      isSynthetic: body.isSynthetic === true,
      exclusionReason: body.exclusionReason || null,
      createdAt: body.createdAt || new Date().toISOString(),
      observedAt: body.observedAt || new Date().toISOString(),
    });

    if (isDatabaseEnabled()) {
      try {
        const persisted = await withWorldModelTimeout(
          recordWorldModelTrajectory({ ...record, persistenceStatus: "persisted" }),
          WORLD_MODEL_CONTROLS.persistenceTimeoutMs
        );
        if (persisted) {
          return res.status(201).json({ ok: true, ...persisted, mode: "database" });
        }
        console.warn("⚠️ World trajectory persistence exceeded shadow timeout; retaining memory fallback");
      } catch (error) {
        console.error("⚠️ World trajectory persistence failed; retaining memory fallback:", error?.message || error);
      }
    }

    rememberWorldModelTrajectory({
      ...record,
      persistenceStatus: isDatabaseEnabled() ? "memory_fallback" : "memory_only",
      classification: classifyWorldTrajectory({
        hasPrediction: Boolean(record.symbolicPrediction || record.predictedObservation),
        hasObservation: Boolean(record.observedObservation || record.observedState),
        persistenceFailed: isDatabaseEnabled(),
        invalidAction: Boolean(record.symbolicPrediction?.violations?.length),
        isTest: record.isTest,
        isSynthetic: record.isSynthetic,
      }).classification,
    });
    return res.status(202).json({
      ok: true,
      trajectoryId: record.trajectoryId,
      persisted: false,
      mode: "memory_fallback",
    });
  } catch (error) {
    console.error("❌ /api/world-model/trajectories failed:", error);
    return res.status(error.status || 400).json({ error: error.message });
  }
});

// ------------------------------------------------------------
// 3️⃣ AI Reasoning Endpoint
// ------------------------------------------------------------
const hostedModelClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const openai = createJozModelGateway({ client: hostedModelClient });
const modelRuntime = getJozModelRuntimeDescriptor(openai);

function buildWorldAwarenessTrace({ input, appContext = {}, legacyContext = {}, answerSource }) {
  const answerContext = buildMeetJozWorldAnswerContext({ input, appContext, legacyContext });
  const entity = resolveMeetJozWorldEntity({ input, appContext, legacyContext });
  const resolution = buildMeetJozWorldAwarenessResolution({ input, appContext, legacyContext });
  return {
    detectedIntent: answerContext.route,
    detectedConcept: resolution.detectedConcept || entity.entity || null,
    selectedRoute: answerContext.route,
    selectedWorldRecord: resolution.selectedWorldRecord || entity.worldRecord || null,
    answerSource: resolution.answerSource || answerSource,
    responseMode: resolution.responseMode || null,
    composer: resolution.composer || null,
    fallbackUsed: Boolean(resolution.fallbackUsed),
    validationPassed: resolution.validationPassed !== false,
  };
}

function logWorldAwarenessTrace(label, trace) {
  console.log(`🧭 ${label} trace`, trace);
}

function rememberJozObservabilityEvent(event) {
  jozObservabilityFallbackStore.unshift({
    id: `memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
    conversation_id: event?.conversationId || null,
    session_key: event?.sessionKey || null,
    ...event,
  });
  if (jozObservabilityFallbackStore.length > 100) {
    jozObservabilityFallbackStore.length = 100;
  }
}

function getFallbackWorldTransitionExperience({ stateKey = "", actionKey = "" } = {}) {
  return worldTransitionExperienceFallbackStore.filter(
    (row) => row.state_key === stateKey && row.action_key === actionKey
  );
}

async function persistCompletedWorldModelPrediction({ prediction, approved, sampleRate } = {}) {
  if (!prediction?.trajectoryId) return null;
  const selectedAction = prediction.selected?.actions?.[0] || null;
  const record = buildWorldTrajectoryRecord({
    trajectoryId: prediction.trajectoryId,
    sessionId: prediction.sessionId,
    traceId: prediction.traceId,
    stateBefore: prediction.initialState || {},
    stateHistory: [],
    proposedAction: selectedAction,
    symbolicPrediction: prediction.selected || null,
    probabilisticPrediction: prediction.probabilistic?.selected || null,
    expectedEffects: prediction.selected?.expectedEffects || [],
    observationBefore: prediction.observationBefore || null,
    predictedObservation: prediction.selected?.predictedObservation || prediction.probabilistic?.selected?.predictedObservation || null,
    plannerSelectedAction: prediction.plannerSelected?.actions?.[0] || null,
    deterministicApprovedAction: approved?.action || null,
    candidatePlans: prediction.candidates || [],
    classification: "partial",
    failureCategory: null,
    persistenceStatus: "persisted",
    sampleRate,
    sampled: true,
    modelVersion: prediction.modelVersion,
    transitionRuleVersion: prediction.transitionRuleVersion,
    shadowLatencyMs: prediction.shadowLatencyMs,
    predictionLatencyMs: prediction.shadowLatencyMs,
    createdAt: prediction.recordedAt || new Date().toISOString(),
  });

  if (isDatabaseEnabled()) {
    const persisted = await withWorldModelTimeout(
      recordWorldModelTrajectory(record),
      WORLD_MODEL_CONTROLS.persistenceTimeoutMs
    );
    if (persisted) return persisted;
  }
  rememberWorldModelTrajectory({ ...record, persistenceStatus: "memory_fallback" });
  return { trajectoryId: record.trajectoryId, persisted: false, mode: "memory_fallback" };
}

function rememberCompletedWorldModelPrediction({ prediction, approved } = {}) {
  if (!prediction?.trajectoryId) return;
  const safePrediction = {
    ...prediction,
    input: "",
    sessionId: null,
    pending: false,
    mode: "shadow",
    approvedAction: approved?.action || prediction.approvedAction || null,
    approvedTarget: approved?.target || prediction.approvedTarget || null,
  };
  worldModelPredictionFallbackStore.set(prediction.trajectoryId, safePrediction);
  while (worldModelPredictionFallbackStore.size > 100) {
    const oldest = worldModelPredictionFallbackStore.keys().next().value;
    worldModelPredictionFallbackStore.delete(oldest);
  }
}

function rememberWorldModelTrajectory(record) {
  worldModelTrajectoryFallbackStore.unshift(record);
  if (worldModelTrajectoryFallbackStore.length > 200) {
    worldModelTrajectoryFallbackStore.length = 200;
  }

  const stateBefore = record.stateBefore || {};
  const observedState = record.observedState || {};
  const stateKey = String(stateBefore.currentStateKey || stateBefore.portal || "unknown");
  const actionKey = String(
    record.proposedAction?.type || record.proposedAction?.action || record.proposedAction || "unknown"
  );
  const nextStateKey = String(observedState.currentStateKey || observedState.portal || "unknown");
  const nextPortal = String(observedState.portal || "");
  const nextStage = String(observedState.stage || "");
  const existing = worldTransitionExperienceFallbackStore.find(
    (row) =>
      row.state_key === stateKey &&
      row.action_key === actionKey &&
      row.next_state_key === nextStateKey &&
      row.next_portal === nextPortal &&
      row.next_stage === nextStage
  );
  const row = existing || {
    state_key: stateKey,
    action_key: actionKey,
    next_state_key: nextStateKey,
    next_portal: nextPortal,
    next_stage: nextStage,
    target_route: String(observedState.targetRoute || ""),
    attempts: 0,
    successes: 0,
    average_duration_ms: 0,
    average_prediction_error: 0,
  };
  row.attempts += 1;
  row.successes += record.success === true ? 1 : 0;
  row.average_duration_ms =
    ((row.average_duration_ms * (row.attempts - 1)) + Number(record.transitionDurationMs || 0)) /
    row.attempts;
  row.average_prediction_error =
    ((row.average_prediction_error * (row.attempts - 1)) +
      Number(record.predictionDifferences?.metrics?.mismatchCount || 0)) /
    row.attempts;
  row.last_observed_at = record.observedAt || new Date().toISOString();
  if (!existing) worldTransitionExperienceFallbackStore.push(row);
}

function normalizeCallbackField(value = "", maxLength = 160) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function normalizePrivacyEmail(value = "") {
  return normalizeCallbackField(value, 160).toLowerCase();
}

function normalizePrivacyPhone(value = "") {
  return String(value || "").replace(/\D+/g, "").slice(0, 32);
}

function normalizePrivacyRequestType(value = "") {
  const normalized = normalizeCallbackField(value, 32).toLowerCase();
  return normalized === "delete" ? "delete" : normalized === "export" ? "export" : "";
}

function hasVerifiedPrivacyLookup({ conversationId, sessionKey, callbackRequestId, email, phone }) {
  return Boolean(
    (conversationId && sessionKey) ||
      (callbackRequestId && (email || phone))
  );
}

function getPrivacyRuntimeInfo() {
  const processors = [];
  if (isDatabaseEnabled() || process.env.SUPABASE_URL) processors.push("Supabase");
  if (process.env.OPENAI_API_KEY || process.env.JOZ_MODEL_PROVIDER === "openai") {
    processors.push("OpenAI");
  }
  if (process.env.RESEND_API_KEY) processors.push("Resend");
  if (!processors.length) processors.push("Configured application hosting");

  return {
    retentionDays: {
      conversations: JOZ_CONVERSATION_RETENTION_DAYS,
      callbackRequests: JOZ_CALLBACK_RETENTION_DAYS,
      privacyRequests: JOZ_PRIVACY_REQUEST_RETENTION_DAYS,
    },
    processors,
  };
}

function buildCallbackNotificationText(record) {
  return [
    "New Get Called request",
    `Name: ${record.name}`,
    `Phone: ${record.phone}`,
    `Best time: ${record.time}`,
    `Email: ${record.email || "Not provided"}`,
    `Source: ${record.source}`,
    `Conversation ID: ${record.conversationId || "Not available"}`,
  ].join("\n");
}

function getConfiguredCallbackChannels() {
  return {
    email:
      Boolean(process.env.RESEND_API_KEY) &&
      Boolean(process.env.CALLBACK_EMAIL_TO) &&
      Boolean(process.env.CALLBACK_EMAIL_FROM),
  };
}

async function sendCallbackEmail(record) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${String(process.env.RESEND_API_KEY || "").trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: String(process.env.CALLBACK_EMAIL_FROM || "").trim(),
      to: [String(process.env.CALLBACK_EMAIL_TO || "").trim()],
      subject: `Get Called request from ${record.name}`,
      text: buildCallbackNotificationText(record),
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend email failed with ${response.status}`);
  }

  return response.json();
}

async function deliverCallbackRequest(record) {
  const configured = getConfiguredCallbackChannels();
  const channels = [];
  const errors = [];

  if (configured.email) {
    try {
      await sendCallbackEmail(record);
      channels.push("email");
    } catch (error) {
      errors.push(`email:${error?.message || error}`);
    }
  }

  const anyChannelConfigured = configured.email;
  const status = channels.length
    ? "delivered"
    : anyChannelConfigured
      ? "delivery_failed"
      : "stored_only";

  return {
    status,
    channels,
    errors,
  };
}

function rememberCallbackRequest(record) {
  jozCallbackFallbackStore.push({
    ...record,
    storedAt: new Date().toISOString(),
  });
}

function pruneFallbackCallbackStore() {
  const cutoffTime =
    Date.now() - JOZ_CALLBACK_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;

  for (let index = jozCallbackFallbackStore.length - 1; index >= 0; index -= 1) {
    const storedAt = new Date(jozCallbackFallbackStore[index]?.storedAt || 0).getTime();
    if (Number.isFinite(storedAt) && storedAt < cutoffTime) {
      jozCallbackFallbackStore.splice(index, 1);
      removed += 1;
    }
  }

  return removed;
}

async function applyPrivacyRetentionPolicy() {
  const summary = await cleanupExpiredJozData({
    conversationRetentionDays: JOZ_CONVERSATION_RETENTION_DAYS,
    callbackRetentionDays: JOZ_CALLBACK_RETENTION_DAYS,
    privacyRequestRetentionDays: JOZ_PRIVACY_REQUEST_RETENTION_DAYS,
    worldModelRetentionDays: JOZ_WORLD_MODEL_RETENTION_DAYS,
  });
  const removedFallbackCallbacks = pruneFallbackCallbackStore();

  if (
    summary.deletedConversations ||
    summary.deletedCallbackRequests ||
    summary.deletedPrivacyRequests ||
    removedFallbackCallbacks
  ) {
    console.log("🧹 Privacy retention cleanup", {
      ...summary,
      deletedFallbackCallbackRequests: removedFallbackCallbacks,
    });
  }
}

await applyPrivacyRetentionPolicy();

async function exportFallbackPrivacyBundle({ callbackRequestId, email, phone }) {
  const normalizedEmail = normalizePrivacyEmail(email);
  const normalizedPhone = normalizePrivacyPhone(phone);
  const callbackRequestIdText = callbackRequestId ? String(callbackRequestId) : "";
  const callbackRequests = jozCallbackFallbackStore.filter((record) => {
    const emailMatches =
      !normalizedEmail ||
      normalizePrivacyEmail(record.email || record.requestedEmail || "") === normalizedEmail;
    const phoneMatches =
      !normalizedPhone ||
      normalizePrivacyPhone(record.phone || record.requestedPhone || "") === normalizedPhone;
    const callbackIdMatches =
      !callbackRequestIdText ||
      String(record.callbackRequestId || record.id || "") === callbackRequestIdText;
    return emailMatches && phoneMatches && callbackIdMatches;
  });

  return {
    exportedAt: new Date().toISOString(),
    filters: {
      conversationId: null,
      sessionKey: null,
      callbackRequestId: callbackRequestId || null,
      email: email || null,
      phone: phone || null,
    },
    conversations: [],
    messages: [],
    callbackRequests,
  };
}

function deleteFallbackPrivacyBundle({ callbackRequestId, email, phone }) {
  const normalizedEmail = normalizePrivacyEmail(email);
  const normalizedPhone = normalizePrivacyPhone(phone);
  const callbackRequestIdText = callbackRequestId ? String(callbackRequestId) : "";
  let deletedCallbackRequests = 0;

  for (let index = jozCallbackFallbackStore.length - 1; index >= 0; index -= 1) {
    const record = jozCallbackFallbackStore[index];
    const emailMatches =
      !normalizedEmail ||
      normalizePrivacyEmail(record.email || record.requestedEmail || "") === normalizedEmail;
    const phoneMatches =
      !normalizedPhone ||
      normalizePrivacyPhone(record.phone || record.requestedPhone || "") === normalizedPhone;
    const callbackIdMatches =
      !callbackRequestIdText ||
      String(record.callbackRequestId || record.id || "") === callbackRequestIdText;

    if (emailMatches && phoneMatches && callbackIdMatches) {
      jozCallbackFallbackStore.splice(index, 1);
      deletedCallbackRequests += 1;
    }
  }

  return {
    deletedConversations: 0,
    deletedMessages: 0,
    deletedCallbackRequests,
  };
}

app.get("/api/privacy/meta", (req, res) => {
  res.json({
    ok: true,
    ...getPrivacyRuntimeInfo(),
  });
});

app.post("/api/privacy/export", async (req, res) => {
  try {
    await applyPrivacyRetentionPolicy();

    const conversationId = normalizeCallbackField(req.body?.conversationId, 120) || null;
    const sessionKey = normalizeCallbackField(req.body?.sessionKey, 120) || null;
    const callbackRequestId = normalizeCallbackField(req.body?.callbackRequestId, 80) || null;
    const email = normalizePrivacyEmail(req.body?.email);
    const phone = normalizePrivacyPhone(req.body?.phone);

    if (!hasVerifiedPrivacyLookup({ conversationId, sessionKey, callbackRequestId, email, phone })) {
      return res.status(400).json({
        error:
          "Provide conversationId plus sessionKey, or callbackRequestId plus the matching email or phone.",
      });
    }

    const payload = isDatabaseEnabled()
      ? await exportJozPrivacyBundle({
          conversationId,
          sessionKey,
          callbackRequestId,
          email,
          phone,
        })
      : await exportFallbackPrivacyBundle({ callbackRequestId, email, phone });

    const privacyRequestId = await createJozPrivacyRequest({
      requestType: "export",
      requestStatus:
        payload.conversations.length || payload.messages.length || payload.callbackRequests.length
          ? "completed"
          : "no_match",
      email: email || null,
      phone: phone || null,
      conversationId,
      callbackRequestId: callbackRequestId ? Number(callbackRequestId) || null : null,
      sessionKey,
      source: "api_privacy_export",
      payload: {
        matchCounts: {
          conversations: payload.conversations.length,
          messages: payload.messages.length,
          callbackRequests: payload.callbackRequests.length,
        },
      },
    });

    return res.json({
      ok: true,
      privacyRequestId,
      ...getPrivacyRuntimeInfo(),
      data: payload,
    });
  } catch (error) {
    console.error("❌ /api/privacy/export failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/privacy/delete", async (req, res) => {
  try {
    await applyPrivacyRetentionPolicy();

    const conversationId = normalizeCallbackField(req.body?.conversationId, 120) || null;
    const sessionKey = normalizeCallbackField(req.body?.sessionKey, 120) || null;
    const callbackRequestId = normalizeCallbackField(req.body?.callbackRequestId, 80) || null;
    const email = normalizePrivacyEmail(req.body?.email);
    const phone = normalizePrivacyPhone(req.body?.phone);

    if (!hasVerifiedPrivacyLookup({ conversationId, sessionKey, callbackRequestId, email, phone })) {
      return res.status(400).json({
        error:
          "Provide conversationId plus sessionKey, or callbackRequestId plus the matching email or phone.",
      });
    }

    const deletion = isDatabaseEnabled()
      ? await deleteJozPrivacyBundle({
          conversationId,
          sessionKey,
          callbackRequestId,
          email,
          phone,
        })
      : deleteFallbackPrivacyBundle({ callbackRequestId, email, phone });

    const privacyRequestId = await createJozPrivacyRequest({
      requestType: "delete",
      requestStatus:
        deletion.deletedConversations ||
        deletion.deletedMessages ||
        deletion.deletedCallbackRequests
          ? "completed"
          : "no_match",
      email: email || null,
      phone: phone || null,
      conversationId,
      callbackRequestId: callbackRequestId ? Number(callbackRequestId) || null : null,
      sessionKey,
      source: "api_privacy_delete",
      payload: deletion,
    });

    return res.json({
      ok: true,
      privacyRequestId,
      ...getPrivacyRuntimeInfo(),
      deletion,
    });
  } catch (error) {
    console.error("❌ /api/privacy/delete failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/privacy/request", async (req, res) => {
  try {
    await applyPrivacyRetentionPolicy();

    const requestType = normalizePrivacyRequestType(req.body?.requestType);
    const conversationId = normalizeCallbackField(req.body?.conversationId, 120) || null;
    const sessionKey = normalizeCallbackField(req.body?.sessionKey, 120) || null;
    const callbackRequestId = normalizeCallbackField(req.body?.callbackRequestId, 80) || null;
    const email = normalizePrivacyEmail(req.body?.email);
    const phone = normalizePrivacyPhone(req.body?.phone);
    const details = normalizeCallbackField(req.body?.details, 800);

    if (!requestType) {
      return res.status(400).json({ error: "requestType must be export or delete" });
    }

    const privacyRequestId = await createJozPrivacyRequest({
      requestType,
      requestStatus: hasVerifiedPrivacyLookup({
        conversationId,
        sessionKey,
        callbackRequestId,
        email,
        phone,
      })
        ? "received"
        : "needs_manual_review",
      email: email || null,
      phone: phone || null,
      conversationId,
      callbackRequestId: callbackRequestId ? Number(callbackRequestId) || null : null,
      sessionKey,
      source: "api_privacy_request",
      payload: {
        details,
        userAgent: String(req.headers["user-agent"] || "").slice(0, 500),
        ip: getClientIp(req),
      },
    });

    return res.json({
      ok: true,
      privacyRequestId,
      message:
        "Privacy request recorded. If verification is insufficient for automatic handling, manual review is required.",
      ...getPrivacyRuntimeInfo(),
    });
  } catch (error) {
    console.error("❌ /api/privacy/request failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/joz-llm", async (req, res) => {
  try {
    const requestStartedAt = Date.now();
    const requestId =
      String(req.headers["x-request-id"] || "").trim().slice(0, 120) || randomUUID();
    res.setHeader("X-Request-ID", requestId);
    res.setHeader("X-AI-Interaction", "Joz LLM");
    res.setHeader("X-AI-System-Card", "/api/ai-system-card");
    const requestGeoPromise = isNodeTestRuntime
      ? Promise.resolve(null)
      : resolveJozRequestGeo(getClientIp(req));
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const context = req.body?.context || {};
    const sessionKey = String(req.body?.conversationId || req.body?.sessionKey || "").trim() || null;
    const latestUserMessage =
      [...messages].reverse().find((entry) => entry?.role === "user")?.content || "";
    const legacyRuntimeContext = {
      currentPortal: context?.currentPortal || "root",
      currentMesh: context?.currentMesh || null,
      currentMeshStage: context?.currentMeshStage || null,
    };

    if (!String(latestUserMessage || "").trim()) {
      return res.status(400).json({ error: "Missing user message" });
    }

    const validatedAppContext = validateAppContext(
      context?.app_context || {},
      legacyRuntimeContext
    ).value;
    const rateLimitResult = enforceJozChatRateLimit(
      req,
      sessionKey,
      latestUserMessage
    );
    if (rateLimitResult) {
      return res.status(rateLimitResult.status).json(rateLimitResult);
    }

    const governanceAssessment = assessAIActUse({
      input: latestUserMessage,
      messages,
    });
    if (!governanceAssessment.allowedForDiagnostic) {
      const profile = await getPrimaryJozProfile();
      const conversationId = await createJozConversation({
        profileId: profile?.id,
        sessionKey,
        intentMode: "governance_review",
        context: legacyRuntimeContext,
      });
      const reply = buildAIActRestrictedReply(governanceAssessment);
      const trace = {
        requestId,
        selectedRoute: "governance_review",
        governance: governanceAssessment,
        validationPassed: true,
        answerSource: "deterministic_governance_guard",
        modelRuntime,
      };
      const verification = {
        status: "blocked",
        governance: governanceAssessment,
        checks: [
          {
            id: "ai_act_intended_use_gate",
            status: "blocked",
            detail: governanceAssessment.reason,
          },
        ],
      };
      const review = {
        required: true,
        reasons: ["ai_act_intended_use_review"],
        status: "unreviewed",
      };
      if (conversationId) {
        await appendJozMessage({
          conversationId,
          role: "user",
          content: latestUserMessage,
          metadata: { route: "governance_review", requestId, governance: governanceAssessment },
        });
        await appendJozMessage({
          conversationId,
          role: "assistant",
          content: reply,
          metadata: { route: "governance_review", requestId, governance: governanceAssessment },
        });
      }
      const observabilityEvent = {
        conversationId,
        sessionKey,
        route: "governance_review",
        intentMode: "governance_review",
        userMessage: latestUserMessage,
        assistantReply: reply,
        requestContext: legacyRuntimeContext,
        trace,
        verification,
        review,
        retrievedCategories: [],
        retrievedDocuments: [],
        latencyMs: Date.now() - requestStartedAt,
        responseStatus: "governance_blocked",
      };
      if (isDatabaseEnabled()) {
        await logJozLlmRequestEvent(observabilityEvent);
      } else {
        rememberJozObservabilityEvent(observabilityEvent);
      }
      return res.json({
        reply,
        aiDisclosure: AI_MACHINE_READABLE_DISCLOSURE,
        aiDisclosureText: AI_DISCLOSURE_TEXT,
        buildId: JOZ_BUILD_ID,
        routerVersion: JOZ_ROUTER_VERSION,
        modelRuntime,
        conversationId,
        requestId,
        intentMode: "governance_review",
        mode: "governance_review",
        actions: [],
        citations: [],
        retrievedCategories: [],
        trace,
        intent: { kind: "refuse", risk: "high", confidence: 1 },
        agentPlan: null,
        risk: "high",
        execution: { status: "approval_required", proposed: false, executed: false },
        proposal: null,
        approval: null,
        businessValueCaseId: null,
        businessValueAgent: null,
        governance: governanceAssessment,
        verification,
        review,
        verificationFlow: { corrected: false, initial: { verificationStatus: "blocked" }, final: { verificationStatus: "blocked" } },
        observability: { latencyMs: Date.now() - requestStartedAt, retrievedDocumentCount: 0, logged: true },
      });
    }

    const requestGeo = await requestGeoPromise;
    const answerContext = requestGeo
      ? { ...context, visitorGeo: requestGeo }
      : context;

    const requestConversationMessages = messages
      .filter((message) => message?.role === "user" || message?.role === "assistant")
      .map((message) => ({
        role: message.role,
        content: String(message.content || ""),
        metadata: message?.metadata && typeof message.metadata === "object" ? message.metadata : {},
      }));
    const recentSessionMessages = [
      ...getFallbackRecentJozSessionMessages({ sessionKey, limit: 12 }),
      ...requestConversationMessages,
    ].slice(-12);
    const route = routeJozLlmQueryWithAwareness({
      input: latestUserMessage,
      appContext: validatedAppContext,
      legacyContext: legacyRuntimeContext,
      recentMessages: recentSessionMessages,
    });
    const architectureOfferDisabled =
      [
        "paid_architecture_boundary",
        "paid_architecture_intake_start",
        "paid_architecture_intake",
        "paid_architecture_spec",
      ].includes(route.detectedSubIntent) ||
      /\b(?:paid\s+architecture\s+brief|architecture\s+review|pay\s+and\s+start|start\s+(?:the\s+)?brief)\b/i.test(
        latestUserMessage
      );
    const intentClassification = await classifyJozIntent({
      openai,
      input: latestUserMessage,
      messages,
      context,
      route,
    });
    const agentPlan = buildJozAgentPlan({ classification: intentClassification });
    const laneHint = String(context?.intentMode || "").trim().toLowerCase();
    const intentMode =
      (route.selectedRoute !== "unknown_fallback" && route.selectedRoute) ||
      laneHint ||
      route.selectedRoute;
    const profile = await getPrimaryJozProfile();
    const conversationId = await createJozConversation({
      profileId: profile?.id,
      sessionKey,
      intentMode,
      context: legacyRuntimeContext,
    });

    const retrievalIntentMode =
      route.selectedRoute === "business_need" ||
      route.selectedRoute === "systems_mindset" ||
      route.selectedRoute === "skills"
        ? route.selectedRoute
        : "skills";
    const retrievalMeta = {
      method: "exact",
      semanticEnabled: false,
      semanticStatus: isJozPgvectorEnabled() ? "not_requested" : "disabled_by_feature_flag",
      exactCount: 0,
      semanticCount: 0,
      embeddingModel: null,
    };
    const exactDocuments = intentClassification.needsClarification ||
      intentClassification.kind === "execute" ||
      intentClassification.kind === "refuse"
      ? []
      : await getJozDocumentsByIntent(retrievalIntentMode, 8, latestUserMessage);
    let retrievedDocuments = exactDocuments;
    retrievalMeta.exactCount = exactDocuments.length;

    const canUseSemanticRetrieval =
      isJozPgvectorEnabled() &&
      Boolean(hostedModelClient?.embeddings?.create) &&
      isDatabaseEnabled() &&
      !intentClassification.needsClarification &&
      intentClassification.kind !== "execute" &&
      intentClassification.kind !== "refuse";

    if (canUseSemanticRetrieval) {
      retrievalMeta.semanticEnabled = true;
      retrievalMeta.semanticStatus = "requested";
      retrievalMeta.embeddingModel = getJozEmbeddingModel();
      try {
        const queryEmbedding = await createJozQueryEmbedding({
          client: hostedModelClient,
          query: latestUserMessage,
          model: retrievalMeta.embeddingModel,
        });
        if (queryEmbedding) {
          const semanticDocuments = await getJozSemanticDocumentsByQuery(
            retrievalIntentMode,
            queryEmbedding,
            8
          );
          retrievedDocuments = mergeJozRetrievalResults({
            exactDocuments,
            semanticDocuments,
            limit: 8,
          });
          retrievalMeta.method = semanticDocuments.length ? "hybrid" : "exact_fallback";
          retrievalMeta.semanticCount = semanticDocuments.length;
          retrievalMeta.semanticStatus = semanticDocuments.length ? "ok" : "empty";
        } else {
          retrievalMeta.semanticStatus = "embedding_empty";
        }
      } catch (error) {
        retrievalMeta.method = "exact_fallback";
        retrievalMeta.semanticStatus = "unavailable";
        retrievalMeta.semanticError = String(error?.code || error?.message || "semantic_retrieval_failed").slice(0, 160);
      }
    } else if (isJozPgvectorEnabled() && !isDatabaseEnabled()) {
      retrievalMeta.semanticStatus = "database_unavailable";
    } else if (isJozPgvectorEnabled() && !hostedModelClient?.embeddings?.create) {
      retrievalMeta.semanticStatus = "embedding_client_unavailable";
    }
    let retrievalContext = retrievedDocuments.map((doc) => ({
      title: doc.title,
      category: doc.category,
      summary: doc.summary,
      body: doc.body,
      metadata: doc.metadata,
    }));

    // Graph retrieval starts in shadow mode. It observes the same request and
    // records evidence paths, but it does not enter the model context unless
    // the deployment explicitly promotes it to augment mode.
    const knowledgeGraphMode = getJozKnowledgeGraphMode();
    let knowledgeGraph = null;
    if (knowledgeGraphMode !== "disabled" && intentClassification.kind !== "execute" && intentClassification.kind !== "refuse") {
      knowledgeGraph = await queryJozKnowledgeGraphRuntime({
        query: latestUserMessage,
        limit: 8,
      });
      if (knowledgeGraphMode === "augment" && knowledgeGraph.documents.length) {
        const graphEvidenceBySlug = new Map(
          knowledgeGraph.documents.map((document) => [document.slug, document])
        );
        retrievalContext = retrievalContext.map((document) => {
          const slug = String(document?.metadata?.slug || "").trim();
          const graphEvidence = graphEvidenceBySlug.get(slug);
          if (!graphEvidence) return document;
          return {
            ...document,
            metadata: {
              ...(document.metadata || {}),
              graphEvidence: {
                score: graphEvidence.score,
                path: graphEvidence.path,
                edgeTypes: graphEvidence.edgeTypes,
              },
            },
          };
        });
      }
      retrievalMeta.knowledgeGraph = {
        mode: knowledgeGraphMode,
        backend: knowledgeGraph.backend || "artifact",
        fallbackReason: knowledgeGraph.fallbackReason || null,
        shadow: knowledgeGraphMode !== "augment",
        activeInContext: knowledgeGraphMode === "augment" && retrievalContext.some((document) => document?.metadata?.graphEvidence),
        nodeCount: knowledgeGraph.nodeCount,
        edgeCount: knowledgeGraph.edgeCount,
        matchedNodeCount: knowledgeGraph.matchedNodeIds.length,
        candidateDocumentCount: knowledgeGraph.documentSlugs.length,
        candidateDocumentSlugs: knowledgeGraph.documentSlugs,
        pathCount: knowledgeGraph.paths.length,
      };
    } else {
      retrievalMeta.knowledgeGraph = {
        mode: knowledgeGraphMode,
        backend: "disabled",
        fallbackReason: null,
        shadow: false,
        activeInContext: false,
        nodeCount: 0,
        edgeCount: 0,
        matchedNodeCount: 0,
        candidateDocumentCount: 0,
        candidateDocumentSlugs: [],
        pathCount: 0,
      };
    }

    const roleAwareContext = buildRoleAwareJozContext({
      buildJozLlmContext,
      profile,
      context: answerContext,
      intentMode: retrievalIntentMode,
      input: latestUserMessage,
      messages: recentSessionMessages,
      route,
      intentClassification,
      agentPlan,
      retrievedDocuments: retrievalContext,
      retrievalMeta,
    });
    roleAwareContext.intentClassification = intentClassification;
    roleAwareContext.agentPlan = agentPlan;
    const riskGateResolution = buildJozRiskGateResolution({
      classification: intentClassification,
      input: latestUserMessage,
    });
    const safetyRefusalResolution = buildJozSafetyRefusalResolution({
      classification: intentClassification,
    });
    const ownedResolution =
      buildVisitorLocationReply(latestUserMessage, requestGeo) ||
      composeJozLlmRouteReply({
        route,
        input: latestUserMessage,
        appContext: validatedAppContext,
        legacyContext: legacyRuntimeContext,
        retrievedDocuments: retrievalContext,
      });
    const rawResolution =
      safetyRefusalResolution ||
      riskGateResolution ||
      (architectureOfferDisabled
        ? {
            reply:
              "Company-specific briefings and checkout are not enabled in this version of Joz LLM. Ask Joz about the architecture, governance, or diagnostic approach instead.",
            answerSource: "feature_disabled",
            composer: "disabledArchitectureOffer",
            fallbackUsed: false,
            intentMode: "skills",
            retrievedCategories: [],
            answerClass: "feature_disabled",
            confidence: "high",
            actions: [],
          }
        : null) ||
      ownedResolution ||
      (await resolveUnknownJozReply({
        input: latestUserMessage,
        messages,
        openai,
        roleAwareContext,
        intentClassification,
      }));
    const resolution = architectureOfferDisabled
      ? rawResolution
      : enforceJozCommercialBoundaryResolution(route, rawResolution);
    const responseRetrievedDocuments =
      route.detectedSubIntent === "paid_architecture_boundary" ? [] : retrievedDocuments;

    assertNoFallbackHijack(route, resolution);

    let reply = String(resolution?.reply || "").trim();
    if (!reply) {
      reply = enforceJozLlmReplyLimit("", 55);
    }
    const preAnswerDraft = reply;

    // Audience classification is observability-only. It does not select a route,
    // alter the answer, or change the verification rules.
    const audienceProfile = classifyJozAudience({
      input: latestUserMessage,
      recentMessages: recentSessionMessages,
      messages,
    });
    let trace = {
      ...buildJozRouteTrace(route, resolution),
      modelRuntime,
      audienceProfile,
      intentClassification,
      agentPlan,
      contextEngineering: roleAwareContext.contextPacket
        ? {
            schema: roleAwareContext.contextPacket.schema,
            budget: roleAwareContext.contextPacket.budget,
            provenance: roleAwareContext.contextPacket.provenance,
          }
        : null,
      retrieval: retrievalMeta,
      risk: intentClassification.risk,
      execution: {
        status: intentClassification.kind === "execute" ? "approval_required" : "not_required",
        proposed: intentClassification.kind === "execute",
        executed: false,
      },
    };
    let verification = buildJozResponseVerification({
      input: latestUserMessage,
      route,
      resolution,
      trace,
      reply,
      retrievedDocuments: responseRetrievedDocuments,
      latencyMs: Date.now() - requestStartedAt,
    });
    const initialVerificationStatus = verification.status;
    let effectiveRoute = route;
    let effectiveResolution = resolution;
    let verificationRecovery = null;

    // A narrowly scoped repair may recover an in-scope business question that
    // was misrouted to the generic boundary. It is accepted only when the
    // repaired answer passes the same deterministic verification checks.
    const fallbackRepair = buildJozInScopeFallbackRepair({
      input: latestUserMessage,
      route,
      resolution,
      retrievedDocuments: retrievalContext,
    });
    if (fallbackRepair) {
      const repairedTrace = {
        ...buildJozRouteTrace(fallbackRepair.route, fallbackRepair.resolution),
        modelRuntime,
        audienceProfile,
        intentClassification,
        agentPlan,
        contextEngineering: roleAwareContext.contextPacket
          ? {
              schema: roleAwareContext.contextPacket.schema,
              budget: roleAwareContext.contextPacket.budget,
              provenance: roleAwareContext.contextPacket.provenance,
            }
          : null,
        retrieval: retrievalMeta,
        risk: intentClassification.risk,
        execution: {
          status: intentClassification.kind === "execute" ? "approval_required" : "not_required",
          proposed: intentClassification.kind === "execute",
          executed: false,
        },
      };
      const repairedVerification = buildJozResponseVerification({
        input: latestUserMessage,
        route: fallbackRepair.route,
        resolution: fallbackRepair.resolution,
        trace: repairedTrace,
        reply: fallbackRepair.resolution.reply,
        retrievedDocuments,
        latencyMs: Date.now() - requestStartedAt,
      });

      if (repairedVerification.status !== "fail") {
        effectiveRoute = fallbackRepair.route;
        effectiveResolution = fallbackRepair.resolution;
        reply = String(fallbackRepair.resolution.reply || "").trim();
        verification = repairedVerification;
        verificationRecovery = {
          corrected: true,
          strategy: fallbackRepair.strategy,
          originalRoute: route.selectedRoute,
          originalAnswerClass: resolution.answerClass || null,
          originalDraft: preAnswerDraft,
          finalAnswer: reply,
        };
        trace = {
          ...repairedTrace,
          verificationRecovery,
        };
      }
    }

    const verificationFlow = {
      corrected: Boolean(verificationRecovery),
      initial: {
        reply: preAnswerDraft,
        verificationStatus: verificationRecovery ? "repaired" : initialVerificationStatus,
        route: route.selectedRoute,
        subIntent: route.detectedSubIntent || null,
      },
      final: {
        reply,
        verificationStatus: verification.status,
        route: effectiveRoute.selectedRoute,
        subIntent: effectiveRoute.detectedSubIntent || null,
      },
    };
    trace = {
      ...trace,
      preAnswerDraft,
      finalAnswer: reply,
      verificationFlow,
    };
    const execution = effectiveResolution?.execution || trace.execution;
    let approval = null;
    if (effectiveResolution?.proposal) {
      const registered = registerJozActionProposal({
        proposal: effectiveResolution.proposal,
        sessionKey,
      });
      const persistedRecord = getJozActionProposalRecord(registered.proposal.proposalId);
      await saveJozActionProposal({
        proposal: registered.proposal,
        sessionKey,
        status: persistedRecord?.status || "pending",
        approvalTokenHash: persistedRecord?.tokenHash || "",
        executionTokenHash: persistedRecord?.executionTokenHash || null,
        createdAt: persistedRecord?.createdAt || null,
        expiresAt: persistedRecord?.expiresAt || registered.approval.expiresAt,
        eventType: "proposed",
        actor: "joz_llm",
        eventMetadata: { risk: registered.proposal.risk || "unknown" },
      });
      effectiveResolution = {
        ...effectiveResolution,
        proposal: registered.proposal,
      };
      execution.proposal = registered.proposal;
      approval = registered.approval;
    }
    trace = { ...trace, execution };
    const reviewReasons = [];
    if (verification.status === "fail") {
      reviewReasons.push("deterministic_verification_failed");
    }
    if (intentClassification.confidenceBand === "medium") {
      reviewReasons.push("medium_intent_confidence");
    }
    if (
      ["business_need", "skills", "systems_mindset"].includes(effectiveRoute.selectedRoute) &&
      verification?.grounding?.status !== "pass"
    ) {
      reviewReasons.push("grounding_needs_review");
    }
    const review = {
      required: reviewReasons.length > 0,
      reasons: reviewReasons,
      status: reviewReasons.length > 0 ? "unreviewed" : "not_required",
    };
    const responseActions = (Array.isArray(effectiveResolution?.actions)
      ? effectiveResolution.actions
      : []
    ).map((action) => {
      if (action?.id !== "architecture_review_pay") return action;
      if (conversationId) {
        return {
          ...action,
          href: `/api/joz-llm/architecture-checkout?conversationId=${encodeURIComponent(conversationId)}`,
        };
      }
      return {
        id: "architecture_review_contact",
        label: "Email Joz to start payment",
        type: "mailto",
        href: "mailto:joz@meetjoz.com?subject=Paid%20architecture%20review",
      };
    }).filter((action) => {
      const actionId = String(action?.id || "").toLowerCase();
      return !actionId.includes("architecture_review") && !actionId.includes("paid_architecture");
    });
    const shouldRunBusinessValueDiagnostic =
      BUSINESS_VALUE_DIAGNOSTIC_ENABLED &&
      (legacyRuntimeContext.currentPortal === "business-value" ||
        effectiveRoute.selectedRoute === "business_need");
    const businessValueCaseRecord =
      shouldRunBusinessValueDiagnostic
        ? await (async () => {
            const fallbackKey = getBusinessValueCaseFallbackKey({ sessionKey, conversationId });
            const previousCase = jozBusinessValueCaseFallbackStore.get(fallbackKey) || null;
            const evidenceRecords = previousCase?.evidenceRecords || [];
            const localState = buildBusinessValueDiagnosticState({
              input: latestUserMessage,
              messages: recentSessionMessages,
              currentMesh: legacyRuntimeContext.currentMesh,
              evidenceRecords,
              priorState: previousCase?.state || null,
            });
            const workerState = await runBusinessValueWorkerDiagnostic({
              caseId: conversationId || sessionKey || fallbackKey,
              input: latestUserMessage,
              messages: recentSessionMessages,
              currentMesh: legacyRuntimeContext.currentMesh,
              evidenceRecords,
              priorState: previousCase?.state || null,
            });
            return persistBusinessValueDiagnosticCase({
              state: applyBusinessValueGovernance({
                state: workerState || localState,
                input: latestUserMessage,
                messages: recentSessionMessages,
                evidenceText: evidenceRecords.map((record) => JSON.stringify(record?.value || {})).join("\n"),
              }),
              conversationId,
              sessionKey,
              companyKey: context?.companyKey || context?.company_key || null,
              evidenceRecords,
            });
          })()
        : null;
    const businessValueAgent = businessValueCaseRecord?.state || null;
    const retrievedCategories =
      effectiveRoute.detectedSubIntent === "paid_architecture_boundary"
        ? []
        : effectiveResolution?.retrievedCategories?.length
        ? effectiveResolution.retrievedCategories
        : retrievedDocuments.map((doc) => doc.category);
    logWorldAwarenessTrace("/api/joz-llm", trace);

    if (conversationId) {
      await appendJozMessage({
        conversationId,
        role: "user",
        content: latestUserMessage,
        metadata: { intentMode: effectiveRoute.selectedRoute, route: effectiveRoute.selectedRoute },
      });
      await appendJozMessage({
        conversationId,
        role: "assistant",
        content: reply,
        metadata: {
          intentMode: effectiveRoute.selectedRoute,
          route: effectiveRoute.selectedRoute,
          retrievedCategories,
          actions: responseActions,
          businessValueAgent,
          trace,
          verification,
          review,
        },
      });
    }

    appendFallbackRecentJozSessionMessage({
      sessionKey,
      role: "user",
      content: latestUserMessage,
      metadata: { intentMode: effectiveRoute.selectedRoute, route: effectiveRoute.selectedRoute },
    });
    appendFallbackRecentJozSessionMessage({
      sessionKey,
      role: "assistant",
      content: reply,
      metadata: {
        intentMode: effectiveRoute.selectedRoute,
        route: effectiveRoute.selectedRoute,
        retrievedCategories,
        businessValueAgent,
        trace,
        verification,
        review,
      },
    });

    const requestContext = {
      ...legacyRuntimeContext,
      ...(requestGeo ? { geo: requestGeo } : {}),
    };
    const observabilityEvent = {
      conversationId,
      sessionKey,
      route: effectiveRoute.selectedRoute,
      intentMode: effectiveRoute.selectedRoute,
      userMessage: latestUserMessage,
      assistantReply: reply,
      requestContext,
      trace,
      verification,
      review,
      retrievedCategories,
      retrievedDocuments: responseRetrievedDocuments.map((doc) => ({
        title: doc.title,
        category: doc.category,
        slug: doc?.metadata?.slug || null,
        verificationStatus:
          doc?.metadata?.verification_status ||
          doc?.metadata?.verification?.status ||
          null,
      })),
      latencyMs: verification.metrics.latencyMs,
      responseStatus:
        verification.status === "fail"
          ? "verification_failed"
          : review.required
            ? "needs_review"
            : "ok",
    };

    if (isDatabaseEnabled()) {
      await logJozLlmRequestEvent(observabilityEvent);
    } else {
      rememberJozObservabilityEvent(observabilityEvent);
    }

    return res.json({
      reply,
      aiDisclosure: AI_MACHINE_READABLE_DISCLOSURE,
      aiDisclosureText: AI_DISCLOSURE_TEXT,
      buildId: JOZ_BUILD_ID,
      routerVersion: JOZ_ROUTER_VERSION,
      modelRuntime,
      conversationId,
      intentMode: effectiveRoute.selectedRoute,
      actions: responseActions,
      citations: Array.isArray(verification?.citations) ? verification.citations : [],
      retrievedCategories,
      mode: effectiveRoute.selectedRoute,
      trace,
      audienceProfile,
      intent: intentClassification,
      agentPlan,
      risk: intentClassification.risk,
      governance: assessAIActUse({
        input: latestUserMessage,
        messages: recentSessionMessages,
        evidenceText: businessValueAgent ? JSON.stringify(businessValueAgent) : "",
      }),
      execution,
      proposal: effectiveResolution?.proposal || null,
      approval,
      businessValueCaseId: businessValueCaseRecord?.caseId || null,
      businessValueAgent,
      verification,
      review,
      verificationFlow,
      observability: {
        latencyMs: verification.metrics.latencyMs,
        retrievedDocumentCount: verification.metrics.retrievedDocumentCount,
        logged: true,
      },
    });
  } catch (error) {
    console.error("❌ /api/joz-llm failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/business-value/cases/:caseId", requireJozAuth, async (req, res) => {
  if (!BUSINESS_VALUE_DIAGNOSTIC_ENABLED) {
    return res.status(410).json({ error: "Business Value diagnostic is disabled." });
  }

  try {
    const caseId = String(req.params?.caseId || "").trim();
    if (!caseId) return res.status(400).json({ error: "Missing caseId" });

    let record = null;
    if (isDatabaseEnabled()) {
      record = await getBusinessValueCase(caseId);
    }
    if (!record) {
      record = [...jozBusinessValueCaseFallbackStore.values()].find(
        (candidate) => candidate.caseId === caseId
      ) || null;
    }
    if (!record) return res.status(404).json({ error: "Business Value case not found" });

    const recordCompanyKey = record.company_key || record.companyKey || null;
    const authenticatedCompanyKey = req.jozAuth?.companyKey || null;
    if (recordCompanyKey && recordCompanyKey !== authenticatedCompanyKey) {
      return res.status(403).json({ error: "Business Value case belongs to another company" });
    }

    return res.json({
      ok: true,
      case: record,
      storage: record.storage || (isDatabaseEnabled() ? "database" : "memory"),
    });
  } catch (error) {
    console.error("❌ Business Value case lookup failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/business-value/cases/:caseId/evidence", requireJozAuth, async (req, res) => {
  if (!BUSINESS_VALUE_DIAGNOSTIC_ENABLED) {
    return res.status(410).json({ error: "Business Value diagnostic is disabled." });
  }

  try {
    const caseId = String(req.params?.caseId || "").trim();
    if (!caseId) return res.status(400).json({ error: "Missing caseId" });

    let record = null;
    if (isDatabaseEnabled()) record = await getBusinessValueCase(caseId);
    if (!record) {
      record = [...jozBusinessValueCaseFallbackStore.values()].find(
        (candidate) => candidate.caseId === caseId
      ) || null;
    }
    if (!record) return res.status(404).json({ error: "Business Value case not found" });

    const bodyCompanyKey = String(req.body?.companyKey || "").trim() || null;
    const authenticatedCompanyKey = req.jozAuth?.companyKey || null;
    if (authenticatedCompanyKey && bodyCompanyKey && authenticatedCompanyKey !== bodyCompanyKey) {
      return res.status(403).json({ error: "Company key does not match authenticated tenant" });
    }
    const requestedCompanyKey = authenticatedCompanyKey || bodyCompanyKey;
    const recordCompanyKey = record.company_key || record.companyKey || null;
    if (recordCompanyKey && recordCompanyKey !== requestedCompanyKey) {
      return res.status(403).json({ error: "Business Value case belongs to another company" });
    }

    let ingestion;
    try {
      let documentContent = String(req.body?.content || "").trim();
      let documentTitle = req.body?.title;
      let documentSourceType = req.body?.sourceType;
      let documentSourceRef = req.body?.sourceRef;
      if (!documentContent && req.body?.data) {
        const extractedFile = extractBusinessValueFile({
          fileName: req.body?.fileName,
          mimeType: req.body?.mimeType,
          data: req.body?.data,
        });
        documentContent = extractedFile.content;
        documentTitle = documentTitle || extractedFile.fileName;
        documentSourceType = documentSourceType || `uploaded_${extractedFile.format}`;
        documentSourceRef = documentSourceRef || extractedFile.fileName;
      }
      ingestion = ingestBusinessValueDocument({
        title: documentTitle,
        content: documentContent,
        sourceType: documentSourceType,
        sourceRef: documentSourceRef,
        companyKey: requestedCompanyKey || recordCompanyKey,
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const existingEvidence = Array.isArray(record.evidenceRecords)
      ? record.evidenceRecords
      : Array.isArray(record.evidence_records)
        ? record.evidence_records.map((item) => ({
            evidenceKey: item.evidence_key,
            node: item.node,
            value: item.value,
            sourceType: item.source_type,
            sourceRef: item.source_ref,
            verificationStatus: item.verification_status,
            collectedAt: item.collected_at,
          }))
        : [];
    const evidenceRecords = dedupeBusinessValueEvidence([
      ...existingEvidence,
      ...ingestion.candidates,
    ]);
    const state = buildBusinessValueDiagnosticState({
      currentMesh: record.state?.activeNode || record.active_node || "data",
      evidenceRecords,
    });
    const persisted = isDatabaseEnabled()
      ? await upsertBusinessValueEvidence({ caseId, records: ingestion.candidates })
      : [];

    if (isDatabaseEnabled()) {
      await upsertBusinessValueCase({
        caseId,
        conversationId: record.conversation_id || record.conversationId || null,
        sessionKey: record.session_key || record.sessionKey || null,
        companyKey: recordCompanyKey || requestedCompanyKey,
        state,
      });
      await appendBusinessValueCaseEvent({
        caseId,
        eventType: "evidence_added",
        payload: {
          documentId: ingestion.document.documentId,
          candidateCount: ingestion.candidates.length,
          verificationStatus: "unverified",
        },
      });
    }

    const fallbackRecord = [...jozBusinessValueCaseFallbackStore.entries()].find(
      ([, candidate]) => candidate.caseId === caseId
    );
    if (fallbackRecord) {
      const [fallbackKey, previous] = fallbackRecord;
      const event = {
        id: `memory-business-value-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        case_id: caseId,
        event_type: "evidence_added",
        actor: "company_user",
        payload: {
          documentId: ingestion.document.documentId,
          candidateCount: ingestion.candidates.length,
          verificationStatus: "unverified",
        },
        created_at: new Date().toISOString(),
      };
      jozBusinessValueCaseFallbackStore.set(fallbackKey, {
        ...previous,
        state: { ...state, caseId },
        evidenceRecords,
        events: [...(previous.events || []), event].slice(-100),
        updatedAt: event.created_at,
      });
    }

    return res.json({
      ok: true,
      caseId,
      document: ingestion.document,
      evidence: ingestion.candidates,
      persistedEvidenceCount: persisted.length,
      state: { ...state, caseId },
      storage: isDatabaseEnabled() ? "database" : "memory",
    });
  } catch (error) {
    console.error("❌ Business Value evidence ingestion failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/business-value/cases/:caseId/evidence/:evidenceKey/review", requireJozAuth, async (req, res) => {
  if (!BUSINESS_VALUE_DIAGNOSTIC_ENABLED) {
    return res.status(410).json({ error: "Business Value diagnostic is disabled." });
  }

  try {
    const caseId = String(req.params?.caseId || "").trim();
    const evidenceKey = decodeURIComponent(String(req.params?.evidenceKey || "").trim());
    const verificationStatus = String(req.body?.verificationStatus || "verified").trim().toLowerCase();
    if (!caseId || !evidenceKey) return res.status(400).json({ error: "Missing caseId or evidenceKey" });
    if (!["claimed", "corroborated", "verified", "rejected"].includes(verificationStatus)) {
      return res.status(400).json({ error: "Unsupported evidence review status" });
    }

    let record = null;
    if (isDatabaseEnabled()) record = await getBusinessValueCase(caseId);
    if (!record) {
      record = [...jozBusinessValueCaseFallbackStore.values()].find(
        (candidate) => candidate.caseId === caseId
      ) || null;
    }
    if (!record) return res.status(404).json({ error: "Business Value case not found" });

    const recordCompanyKey = record.company_key || record.companyKey || null;
    const bodyCompanyKey = String(req.body?.companyKey || "").trim() || null;
    const authenticatedCompanyKey = req.jozAuth?.companyKey || null;
    if (authenticatedCompanyKey && bodyCompanyKey && authenticatedCompanyKey !== bodyCompanyKey) {
      return res.status(403).json({ error: "Company key does not match authenticated tenant" });
    }
    const requestedCompanyKey = authenticatedCompanyKey || bodyCompanyKey;
    if (recordCompanyKey && recordCompanyKey !== requestedCompanyKey) {
      return res.status(403).json({ error: "Business Value case belongs to another company" });
    }

    const existingEvidence = Array.isArray(record.evidenceRecords)
      ? record.evidenceRecords
      : Array.isArray(record.evidence_records)
        ? record.evidence_records.map((item) => ({
            evidenceKey: item.evidence_key,
            node: item.node,
            value: item.value,
            sourceType: item.source_type,
            sourceRef: item.source_ref,
            verificationStatus: item.verification_status,
            collectedAt: item.collected_at,
          }))
        : [];
    const reviewed = existingEvidence.find((item) => item.evidenceKey === evidenceKey);
    if (!reviewed) return res.status(404).json({ error: "Evidence item not found" });

    const evidenceRecords = existingEvidence.map((item) =>
      item.evidenceKey === evidenceKey
        ? {
            ...item,
            verificationStatus,
            verifiedAt: verificationStatus === "verified" ? new Date().toISOString() : null,
          }
        : item
    );
    const state = buildBusinessValueDiagnosticState({
      currentMesh: record.state?.activeNode || record.active_node || reviewed.node || "data",
      evidenceRecords,
      reviewApproved: verificationStatus === "verified",
    });

    if (isDatabaseEnabled()) {
      await reviewBusinessValueEvidence({
        caseId,
        evidenceKey,
        verificationStatus,
        actor: req.jozAuth?.userId || "company_reviewer",
      });
      await upsertBusinessValueCase({
        caseId,
        conversationId: record.conversation_id || record.conversationId || null,
        sessionKey: record.session_key || record.sessionKey || null,
        companyKey: record.company_key || record.companyKey || null,
        state,
      });
      await appendBusinessValueCaseEvent({
        caseId,
        eventType: state.status === "verified" ? "diagnosis_verified" : "diagnosis_updated",
        actor: req.jozAuth?.userId || "company_reviewer",
        payload: { evidenceKey, verificationStatus, status: state.status },
      });
    }

    const fallbackRecord = [...jozBusinessValueCaseFallbackStore.entries()].find(
      ([, candidate]) => candidate.caseId === caseId
    );
    if (fallbackRecord) {
      const [fallbackKey, previous] = fallbackRecord;
      const event = {
        id: `memory-business-value-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        case_id: caseId,
        event_type: state.status === "verified" ? "diagnosis_verified" : "diagnosis_updated",
        actor: req.jozAuth?.userId || "company_reviewer",
        payload: { evidenceKey, verificationStatus, status: state.status },
        created_at: new Date().toISOString(),
      };
      jozBusinessValueCaseFallbackStore.set(fallbackKey, {
        ...previous,
        state: { ...state, caseId },
        evidenceRecords,
        events: [...(previous.events || []), event].slice(-100),
        updatedAt: event.created_at,
      });
    }

    return res.json({
      ok: true,
      caseId,
      evidenceKey,
      verificationStatus,
      state: { ...state, caseId },
      storage: isDatabaseEnabled() ? "database" : "memory",
    });
  } catch (error) {
    console.error("❌ Business Value evidence review failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/joz-llm/proposals/:proposalId/approve", requireJozAuth, async (req, res) => {
  if (isDatabaseEnabled()) {
    const persisted = await loadJozActionProposal(req.params.proposalId);
    if (persisted) hydrateJozActionProposal(persisted);
  }
  const result = approveJozActionProposal({
    proposalId: req.params.proposalId,
    token: req.body?.token,
    approvedBy: req.jozAuth?.userId || req.body?.approvedBy || "chat",
  });
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  const updatedRecord = getJozActionProposalRecord(req.params.proposalId);
  const persistedApproval = await updateJozActionProposal({
    proposalId: req.params.proposalId,
    status: updatedRecord?.status || "approved_not_executed",
    expectedStatus: "pending",
    expectedApprovalTokenHash: updatedRecord?.tokenHash || null,
    executionTokenHash: updatedRecord?.executionTokenHash || null,
    approvedBy: updatedRecord?.approvedBy || "chat",
    approvedAt: updatedRecord?.approvedAt || null,
    eventType: "approved",
    actor: req.jozAuth?.userId || updatedRecord?.approvedBy || "chat",
    eventMetadata: req.jozAuth ? { userId: req.jozAuth.userId, email: req.jozAuth.email } : {},
  });
  if (isDatabaseEnabled() && !persistedApproval) {
    return res.status(409).json({ error: "Proposal was changed by another worker" });
  }
  return res.json(result);
});

app.post("/api/joz-llm/proposals/:proposalId/execute", requireJozAuth, async (req, res) => {
  if (isDatabaseEnabled()) {
    const persisted = await loadJozActionProposal(req.params.proposalId);
    if (persisted) hydrateJozActionProposal(persisted);
  }
  const preExecutionRecord = getJozActionProposalRecord(req.params.proposalId);
  const started = beginJozActionExecution({
    proposalId: req.params.proposalId,
    executionToken: req.body?.executionToken,
  });
  if (!started.ok) return res.status(started.status).json({ error: started.error });
  if (req.jozAuth?.userId && started.proposal?.approvedBy && started.proposal.approvedBy !== req.jozAuth.userId) {
    return res.status(403).json({ error: "Only the approving user can execute this proposal" });
  }
  const persistedStart = await updateJozActionProposal({
    proposalId: req.params.proposalId,
    status: "executing",
    expectedStatus: "approved_not_executed",
    expectedExecutionTokenHash: preExecutionRecord?.executionTokenHash || null,
    executionTokenHash: null,
    eventType: "execution_started",
    actor: req.jozAuth?.userId || "chat",
    eventMetadata: req.jozAuth ? { userId: req.jozAuth.userId, email: req.jozAuth.email } : {},
  });
  if (isDatabaseEnabled() && !persistedStart) {
    return res.status(409).json({ error: "Proposal was changed by another worker" });
  }

  try {
    const result = executeJozAllowlistedAction({ proposal: started.proposal });
    const verification = verifyJozAllowlistedAction({ proposal: started.proposal, result });
    const completed = completeJozActionExecution({
      proposalId: req.params.proposalId,
      result,
      verification,
    });
    await updateJozActionProposal({
      proposalId: req.params.proposalId,
      status: completed?.proposal?.status || "verification_failed",
      expectedStatus: "executing",
      result,
      verification,
      completedAt: completed?.proposal?.completedAt || new Date().toISOString(),
      eventType: verification?.verified ? "verified" : "verification_failed",
      actor: req.jozAuth?.userId || "system",
      eventMetadata: {
        action: started.proposal?.action || null,
        ...(req.jozAuth ? { userId: req.jozAuth.userId, email: req.jozAuth.email } : {}),
      },
    });
    return res.json(completed);
  } catch (error) {
    const verification = { verified: false, checks: [{ id: "executor", status: "fail", detail: error.message }] };
    const completed = completeJozActionExecution({
      proposalId: req.params.proposalId,
      result: null,
      verification,
    });
    await updateJozActionProposal({
      proposalId: req.params.proposalId,
      status: "verification_failed",
      result: null,
      verification,
      completedAt: completed?.proposal?.completedAt || new Date().toISOString(),
      eventType: "execution_failed",
      actor: req.jozAuth?.userId || "system",
      eventMetadata: {
        error: error.message,
        ...(req.jozAuth ? { userId: req.jozAuth.userId, email: req.jozAuth.email } : {}),
      },
    });
    return res.status(error.status || 500).json({ error: error.message, ...completed });
  }
});

app.get("/api/joz-llm/observability", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query?.limit) || 20));
    const events = isDatabaseEnabled()
      ? await listRecentJozLlmRequestEvents(limit)
      : jozObservabilityFallbackStore.slice(0, limit);
    // Decorate older runs at read time so the dashboard can analyze history
    // without rewriting or migrating any existing observability records.
    const decoratedEvents = events.map((event) => {
      if (event?.trace?.audienceProfile || event?.trace?.audience_profile) return event;
      const userMessage = event?.userMessage || event?.user_message || "";
      const audienceProfile = classifyJozAudience({ input: userMessage });
      const existingTrace =
        event?.trace && typeof event.trace === "object"
          ? event.trace
          : (() => {
              try {
                const parsed = JSON.parse(String(event?.trace || ""));
                return parsed && typeof parsed === "object" ? parsed : {};
              } catch {
                return {};
              }
            })();
      return {
        ...event,
        trace: {
          ...existingTrace,
          audienceProfile,
        },
      };
    });

    return res.json({
      ok: true,
      count: decoratedEvents.length,
      storage: isDatabaseEnabled() ? "database" : "memory",
      events: decoratedEvents,
    });
  } catch (error) {
    console.error("❌ /api/joz-llm/observability failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.patch("/api/joz-llm/observability/:id/review", async (req, res) => {
  try {
    if (!isDatabaseEnabled()) {
      return res.status(503).json({ error: "Durable review storage is not configured" });
    }
    const event = await reviewJozLlmRequestEvent({
      eventId: req.params.id,
      reviewStatus: req.body?.reviewStatus,
      issueType: req.body?.issueType,
      reviewNotes: req.body?.reviewNotes,
      approvedCorrection: req.body?.approvedCorrection,
      reviewedBy: req.body?.reviewedBy,
    });
    if (!event) return res.status(404).json({ error: "Observability event not found" });
    return res.json({ ok: true, event });
  } catch (error) {
    console.error("❌ /api/joz-llm observability review failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/joz-llm/evaluations", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query?.limit) || 100));
    const evaluations = isDatabaseEnabled()
      ? await listRecentJozLlmEvaluations(limit)
      : [];
    return res.json({
      ok: true,
      count: evaluations.length,
      storage: isDatabaseEnabled() ? "database" : "memory",
      evaluations,
    });
  } catch (error) {
    console.error("❌ /api/joz-llm/evaluations failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/joz-llm/repair-candidates", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query?.limit) || 100));
    const repairCandidates = isDatabaseEnabled()
      ? await listJozLlmRepairCandidates(limit)
      : [];
    return res.json({
      ok: true,
      count: repairCandidates.length,
      storage: isDatabaseEnabled() ? "database" : "memory",
      repairCandidates,
    });
  } catch (error) {
    console.error("❌ /api/joz-llm/repair-candidates failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.patch("/api/joz-llm/repair-candidates/:id", async (req, res) => {
  try {
    if (!isDatabaseEnabled()) {
      return res.status(503).json({ error: "Durable repair storage is not configured" });
    }
    const action = String(req.body?.action || "").trim().toLowerCase();
    let regressionReport = {};

    if (action === "approve") {
      const goldenRunner = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "tools/check-joz-llm-golden.mjs"
      );
      const result = await execFileAsync(process.execPath, [goldenRunner], {
        timeout: 30_000,
        maxBuffer: 2 * 1024 * 1024,
      });
      regressionReport = JSON.parse(String(result.stdout || "{}"));
      if (regressionReport.failed > 0) {
        return res.status(409).json({
          error: "Repair cannot be approved while the golden regression suite is failing",
          regressionReport,
        });
      }
    }

    const candidate = await reviewJozLlmRepairCandidate({
      candidateId: req.params.id,
      action,
      reviewedBy: req.body?.reviewedBy,
      regressionReport,
    });
    if (!candidate) return res.status(404).json({ error: "Repair candidate not found" });
    return res.json({
      ok: true,
      candidate,
      note:
        action === "approve"
          ? "Approved after the golden regression gate. No production knowledge or routing was mutated automatically."
          : "Repair candidate status updated.",
    });
  } catch (error) {
    console.error("❌ /api/joz-llm repair review failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/joz-llm/landing", async (req, res) => {
  try {
    const label = String(req.body?.label || "").trim();
    const assistantContent = String(req.body?.assistantContent || "").trim();
    const intentMode = String(req.body?.intentMode || "").trim().toLowerCase() || null;
    const sessionKey = String(req.body?.conversationId || req.body?.sessionKey || "").trim() || null;
    const metadata = req.body?.metadata && typeof req.body.metadata === "object"
      ? req.body.metadata
      : {};

    if (!label || !assistantContent) {
      return res.status(400).json({ error: "Missing landing payload" });
    }

    const profile = await getPrimaryJozProfile();
    const conversationId = await createJozConversation({
      profileId: profile?.id,
      sessionKey,
      intentMode,
      context: {
        currentPortal: req.body?.context?.currentPortal || "root",
        currentMesh: req.body?.context?.currentMesh || null,
        currentMeshStage: req.body?.context?.currentMeshStage || null,
      },
    });

    if (conversationId) {
      await appendJozMessage({
        conversationId,
        role: "user",
        content: label,
        messageKind: "landing_selection",
        metadata: {
          intentMode,
          source: "landing_button",
          ...metadata,
        },
      });
      await appendJozMessage({
        conversationId,
        role: "assistant",
        content: assistantContent,
        messageKind: "landing_panel",
        metadata: {
          intentMode,
          source: "landing_button",
          ...metadata,
        },
      });
    }

    return res.json({
      ok: true,
      conversationId,
      intentMode,
    });
  } catch (error) {
    console.error("❌ /api/joz-llm/landing failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/joz-llm/architecture-checkout", async (req, res) => {
  return res.status(410).json({
    error: "Architecture checkout is not enabled in this version of Joz LLM.",
  });
});

app.post("/api/joz-llm/callback-request", async (req, res) => {
  try {
    await applyPrivacyRetentionPolicy();

    const name = normalizeCallbackField(req.body?.name, 120);
    const phone = normalizeCallbackField(req.body?.phone, 80);
    const time = normalizeCallbackField(req.body?.time, 160);
    const email = normalizeCallbackField(req.body?.email, 160);
    const source = normalizeCallbackField(req.body?.source, 80) || "joz_llm";
    const sessionKey =
      normalizeCallbackField(req.body?.conversationId || req.body?.sessionKey, 120) || null;
    const context = {
      currentPortal: req.body?.context?.currentPortal || "root",
      currentMesh: req.body?.context?.currentMesh || null,
      currentMeshStage: req.body?.context?.currentMeshStage || null,
    };
    const consentGiven = req.body?.privacyConsent === true;
    const consent = {
      submitted: consentGiven,
      policyVersion:
        normalizeCallbackField(req.body?.privacyPolicyVersion, 64) || "2026-07-12",
      capturedAt: new Date().toISOString(),
      method:
        normalizeCallbackField(req.body?.privacyConsentMethod, 80) ||
        "callback_request_submission",
    };

    if (!name || !phone || !time) {
      return res.status(400).json({ error: "Missing callback name, phone, or time" });
    }

    if (!consentGiven) {
      return res.status(400).json({ error: "Privacy consent is required for callback requests" });
    }

    const profile = await getPrimaryJozProfile();
    let conversationId = normalizeCallbackField(req.body?.conversationId, 120) || null;

    if (!conversationId && profile?.id) {
      conversationId = await createJozConversation({
        profileId: profile.id,
        sessionKey,
        intentMode: "booking",
        context,
      });
    }

    const record = {
      name,
      phone,
      time,
      email,
      source,
      conversationId,
    };
    const delivery = await deliverCallbackRequest(record);

    if (conversationId) {
      await appendJozMessage({
        conversationId,
        role: "user",
        content: `Get Called request: ${name}, ${phone}, ${time}${email ? `, ${email}` : ""}`,
        messageKind: "callback_request",
        metadata: {
          source,
          deliveryStatus: delivery.status,
          notifiedChannels: delivery.channels,
        },
      });
      await appendJozMessage({
        conversationId,
        role: "assistant",
        content:
          delivery.status === "delivered"
            ? "Callback request saved and delivered to Joz."
            : delivery.status === "delivery_failed"
              ? "Callback request saved, but direct delivery failed."
              : "Callback request saved for follow-up.",
        messageKind: "callback_status",
        metadata: {
          source,
          deliveryStatus: delivery.status,
          notifiedChannels: delivery.channels,
          deliveryErrors: delivery.errors,
        },
      });
    }

    const callbackRequestId = await createJozCallbackRequest({
      conversationId,
      profileId: profile?.id || null,
      requestedName: name,
      requestedPhone: phone,
      requestedTime: time,
      requestedEmail: email || null,
      source,
      payload: { context, consent },
      deliveryStatus: delivery.status,
      deliveryChannels: delivery.channels,
      deliveryErrors: delivery.errors,
    });

    if (!callbackRequestId) {
      rememberCallbackRequest({
        ...record,
        callbackRequestId: null,
        deliveryStatus: delivery.status,
        notifiedChannels: delivery.channels,
        deliveryErrors: delivery.errors,
        consent,
      });
    }

    return res.json({
      ok: true,
      conversationId,
      callbackRequestId,
      delivery,
      persistedTo: callbackRequestId ? "database" : "memory",
    });
  } catch (error) {
    console.error("❌ /api/joz-llm/callback-request failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

function inferStructuredStateKey(currentPortal, currentMesh) {
  if (currentPortal === "root") return "root";
  if (currentPortal === "meet-joz") return normalizeMeshName(currentMesh) || "vibe";
  if (currentPortal === "the-vibe-energy" || currentPortal === "maxx") {
    const mesh = normalizeMeshName(currentMesh);
    if (mesh === "brain_entry") return "brain_entry";
    if (mesh === "signal_flow") return "signal_flow";
    if (mesh === "new_pathways") return "new_pathways";
    if (mesh === "memory_building") return "memory_building";
    if (mesh === "inside_the_brain" || mesh === "inside the brain") return "inside_the_brain";
    return "signal_flow";
  }
  return null;
}

function mergeWorldMapIntoMemory(nextWorldMap) {
  for (const [mesh, info] of Object.entries(nextWorldMap || {})) {
    if (!worldMemory[mesh]) worldMemory[mesh] = { commands: [] };
    worldMemory[mesh] = {
      ...worldMemory[mesh],
      ...info,
      commands: [...new Set([...(worldMemory[mesh].commands || []), ...((info && info.commands) || [])])],
      lastUpdated: new Date().toISOString(),
    };
  }
}

function queueReasoningEvent(event) {
  logReasoningEvent(event).catch((error) => {
    console.error("⚠️ Failed to queue reasoning event:", error?.message || error);
  });
}

function sendReasonedResult(sendThinkResult, payload, source, reasoningEvent = null) {
  if (reasoningEvent) {
    queueReasoningEvent(reasoningEvent);
  }
  return sendThinkResult(payload, source);
}

function decorateThinkPayload(payload, currentPortal, currentMesh) {
  const reasoning = buildReasoningLayers({
    currentPortal,
    currentMesh,
    action: payload?.action || null,
  });

  if (!reasoning) return payload;

  return {
    ...payload,
    awareness: payload?.awareness || reasoning.awareness || null,
    reasoning,
  };
}

app.post("/api/think", async (req, res) => {
  const startedAt = performance.now();
  let currentPortalForResponse = "root";
  let currentMeshForResponse = null;
  const sendThinkResult = (payload, source = "unknown") => {
    const backendSeconds = Number(((performance.now() - startedAt) / 1000).toFixed(2));
    console.log(`⏱️ /api/think ${source}: ${backendSeconds}s`);
    return res.json({
      ...decorateThinkPayload(payload, currentPortalForResponse, currentMeshForResponse),
      timing: {
        backendSeconds,
        source,
      },
    });
  };

  try {
    const { transcript, currentPortal = "root", currentMesh = null, agentContext = null, app_context: appContext = null } = req.body;
    currentPortalForResponse = currentPortal;
    currentMeshForResponse = currentMesh;
    if (!transcript) return res.status(400).json({ error: "Missing transcript" });

    const clean = normalizeTranscript(transcript);
    console.log("🎙️ Reasoning about:", transcript, "→", clean, "inside portal:", currentPortal);
    const allowedActions = Array.isArray(agentContext?.allowedActions)
      ? agentContext.allowedActions.map((value) => String(value || "").trim()).filter(Boolean)
      : null;
    const structuredPortalKey = currentPortal === "maxx" ? "the-vibe-energy" : currentPortal;
    const currentStateKey = inferStructuredStateKey(currentPortal, currentMesh);
    const structuredState = currentStateKey ? await getStructuredWorldState(structuredPortalKey, currentStateKey) : null;
    const enrichedAgentContext = {
      ...(agentContext || {}),
      app_context: appContext || agentContext?.app_context || {},
      structuredState,
      structuredAvailableActions: structuredState?.availableActions || [],
      allowedActions: agentContext?.allowedActions || structuredState?.availableActions || [],
      knownInteractiveMeshes:
        agentContext?.knownInteractiveMeshes ||
        structuredState?.objects?.map((entry) => entry.mesh).filter(Boolean) ||
        [],
    };

    const agenticMatch = resolveAgenticAction({
      clean,
      currentPortal,
      currentMesh,
      agentContext: enrichedAgentContext,
      worldMap,
      worldMemory,
    });
    if (agenticMatch) {
      console.log("🧠 World agent → live graph route", agenticMatch);
      return sendThinkResult(agenticMatch, "agentic");
    }

    const rootMatch = currentPortal === "root" ? classifyRootCommand(clean) : null;
    if (rootMatch) {
      console.log("🧠 Root voice → canonical route", rootMatch);
      return sendThinkResult(rootMatch, "root");
    }

    const utilityMatch = classifyUtilityCommand(clean);
    if (utilityMatch) {
      console.log("🧠 Utility voice → canonical route", utilityMatch);
      return sendThinkResult(utilityMatch, "utility");
    }

    const maxxMatch =
      currentPortal === "the-vibe-energy" || currentPortal === "maxx"
        ? classifyMaxxCommand(clean)
        : null;
    if (maxxMatch) {
      console.log("🧠 MAXX voice → canonical route", maxxMatch);
      return sendThinkResult(maxxMatch, "maxx");
    }

    if (currentPortal === "meet-joz") {
      const commandKey = detectMeetJozCommandKey(clean);
      if (commandKey && isDatabaseEnabled()) {
        const dbMatch = await getPortalTransition("meet-joz", normalizeMeshName(currentMesh), commandKey);
        if (dbMatch) {
          const guarded = applyMeetJozGuardrails(dbMatch, currentMesh);
          console.log("🗄️ meet-joz voice → postgres route", guarded);
          return sendReasonedResult(sendThinkResult, guarded, "postgres", {
            portalKey: "meet-joz",
            currentState: normalizeMeshName(currentMesh),
            transcript,
            normalizedTranscript: clean,
            commandKey,
            resolvedAction: guarded.action,
            resolvedTarget: guarded.target,
            source: "postgres",
          });
        }
      }

      const canonicalMeetJozMatch = applyMeetJozGuardrails(classifyMeetJozCommand(clean, currentMesh), currentMesh);
      if (canonicalMeetJozMatch) {
        console.log("🧠 meet-joz voice → canonical route", canonicalMeetJozMatch);
        return sendReasonedResult(sendThinkResult, canonicalMeetJozMatch, "memory", {
          portalKey: "meet-joz",
          currentState: normalizeMeshName(currentMesh),
          transcript,
          normalizedTranscript: clean,
          commandKey,
          resolvedAction: canonicalMeetJozMatch.action,
          resolvedTarget: canonicalMeetJozMatch.target,
          source: "memory",
        });
      }
    }

    const globalMatch = classifyGlobalCommand(clean, currentPortal);
    if (globalMatch) {
      console.log("🧠 Global voice → canonical route", globalMatch);
      return sendThinkResult(globalMatch, "global");
    }

    // --- world memory match ---
    if (currentPortal === "meet-joz") {
      console.log("🛡️ Skipping world-memory fallback inside meet-joz");
      return sendThinkResult({ action: null, target: null }, "meet_joz_no_world_memory");
    }

    for (const [mesh, data] of Object.entries(worldMemory)) {
      const cmds = (data.commands || []).map((c) => c.toLowerCase());
      if (cmds.some((cmd) => new RegExp(`\\b${cmd}\\b`, "i").test(clean))) {
        const normalizedMesh = normalizeMeshName(mesh);
        if ((normalizedMesh === "vibe" || mesh === "brain" || mesh === "enter_portal") && currentPortal === "root") {
          console.log("🧭 Ignoring stale root world-memory route for:", mesh);
          return sendThinkResult({ action: null, target: null }, "world_memory_ignored");
        }
        const action = normalizeAction(mesh) || mesh;
        const target = canonicalTargetForMesh(mesh) || safeTarget(data.context?.target);
        console.log(`🎯 Match: "${clean}" → ${mesh}`, { action, target });
        return sendReasonedResult(sendThinkResult, { action, target }, "world_memory", {
          portalKey: currentPortal,
          currentState: normalizeMeshName(currentMesh),
          transcript,
          normalizedTranscript: clean,
          commandKey: null,
          resolvedAction: action,
          resolvedTarget: target,
          source: "world-memory",
        });
      }
    }

    // --- fallback to LLM ---
    const portalContext = getWorldContext(currentPortal);
    const allowedActionsPrompt = allowedActions?.length
      ? `Allowed actions (guardrail): ${JSON.stringify(allowedActions)}`
      : "Allowed actions (guardrail): not provided";
    const prompt = `
You are a reasoning agent for a 3D interactive world.
App context: ${JSON.stringify(APP_CONTEXT)}
Current portal: "${currentPortal}"
Current mesh: "${currentMesh || "none"}"
Agent context: ${agentContext ? JSON.stringify(agentContext) : "none"}
${allowedActionsPrompt}
User said: "${transcript}"
Known portal context: ${portalContext ? JSON.stringify(portalContext) : "none"}

Return ONLY valid JSON in this shape:
{ "action": "<known_action_or_null>", "target": "<safe_path_or_null>" }

Rules:
- Only use known actions already present in the app, such as:
  "brain", "ball", "vibe", "discover", "skills", "pause", "resume",
  "back", "vibe_back", "vibe_back1", "n2x_pause", "n2x_resume",
  "launch_in_space_n2x", "launch_in_space_workf",
  "hide_contact_buttons", "show_contact_buttons", "contact_joz", "call_joz"
- If unsure, return { "action": null, "target": null }.
- Never invent mesh names or action names.
- target must be either null, a safe app path beginning with "/", or a mailto:/tel: link.
- Never return plain words like "monk_character" as target.
- Use the app context and portal context to interpret semantic phrases correctly.
- In the MAXX portal, the glossy balls with holes symbolize neurotransmitters, Human Neuron and AI Neuron are concept labels inside the abstract brain scene, Spatial Capability is an interaction surface, and pause/play toggles between the neurotransmitter scene and the deeper inside-the-brain layer.
- In meet-joz, worldx.glb is the surrounding semantic world and is not interactive, model1.glb is the main interactive object, Ascend/Discover is the clout-scale-heart-prestige layer, Skills/Mogg is the deeper work-capability layer, and back actions can visually unwind the sequence toward root.
- If Allowed actions (guardrail) is provided, do not return an action outside that list unless the action is "contact_joz", "call_joz", "hide_contact_buttons", or "show_contact_buttons".
`;

    if (!isJozModelGatewayAvailable(openai)) {
      return sendThinkResult(
        { action: null, target: null, awareness: "No model provider is configured for this voice request." },
        "model_unavailable",
      );
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: "Respond ONLY with valid JSON. No text or explanations." },
        { role: "user", content: prompt },
      ],
    });

    let content = response.choices?.[0]?.message?.content?.trim() || "";
    content = content.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(content);
    const action = normalizeAction(parsed.action);
    const target = safeTarget(parsed.target);
    const utilityActions = new Set([
      "contact_joz",
      "call_joz",
      "hide_contact_buttons",
      "show_contact_buttons",
    ]);
    if (allowedActions?.length && action && !utilityActions.has(action) && !allowedActions.includes(action)) {
      return sendThinkResult(
        {
          action: null,
          target: null,
          awareness: "That step is not available from the current state.",
        },
        "llm_guardrail",
      );
    }
    queueReasoningEvent({
      portalKey: currentPortal,
      currentState: normalizeMeshName(currentMesh),
      transcript,
      normalizedTranscript: clean,
      commandKey: null,
      resolvedAction: action,
      resolvedTarget: target,
      source: "llm",
    });
    return sendThinkResult({ action, target }, "llm");
  } catch (err) {
    console.error("❌ Reasoning failed:", err);
    res.status(500).json({ error: err.message });
  }
});



const port = process.env.PORT || 3001;
const host = (process.env.HOST || "").trim();
const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  if (host) {
    app.listen(port, host, () => {
      console.log(`✅ Server running on http://${host}:${port}`);
    });
  } else {
    app.listen(port, () => {
      console.log(`✅ Server running on port ${port}`);
    });
  }
}

export default app;
