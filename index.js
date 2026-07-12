import express from "express";
import cors from "cors";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  appendJozMessage,
  cleanupExpiredJozData,
  createJozPrivacyRequest,
  createJozCallbackRequest,
  createJozConversation,
  deleteJozPrivacyBundle,
  exportJozPrivacyBundle,
  getPortalTransition,
  getPrimaryJozProfile,
  getJozDocumentsByIntent,
  getStructuredWorldState,
  initDatabase,
  isDatabaseEnabled,
  logReasoningEvent,
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
  buildJozLlmContext,
  enforceJozLlmReplyLimit,
} from "./shared/jozLlmProfile.js";
import {
  assertNoFallbackHijack,
  buildJozRouteTrace,
  buildRoleAwareJozContext,
  composeJozLlmRouteReply,
  resolveUnknownJozReply,
  routeJozLlmQuery,
} from "./shared/jozLlmRouter.js";


dotenv.config();

await initDatabase();

const app = express();
const isEphemeralFilesystem =
  process.env.VERCEL === "1" ||
  process.env.VERCEL === "true" ||
  Boolean(process.env.RENDER) ||
  process.env.DISABLE_FILE_MEMORY === "1";
const canPersistToLocalDisk = !isEphemeralFilesystem;
const JOZ_CHAT_SESSION_WINDOW_MS = 30_000;
const JOZ_CHAT_SESSION_MAX_REQUESTS = 5;
const JOZ_CHAT_IP_WINDOW_MS = 5 * 60_000;
const JOZ_CHAT_IP_MAX_REQUESTS = 20;
const JOZ_CHAT_DUPLICATE_WINDOW_MS = 10_000;
const DEFAULT_JOZ_CONVERSATION_RETENTION_DAYS = 30;
const DEFAULT_JOZ_CALLBACK_RETENTION_DAYS = 30;
const DEFAULT_JOZ_PRIVACY_REQUEST_RETENTION_DAYS = 365;
const jozChatSessionLog = new Map();
const jozChatIpLog = new Map();
const jozChatDuplicateLog = new Map();
const jozCallbackFallbackStore = [];

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

function normalizeJozChatMessage(text = "") {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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
  const forwarded = String(req.headers["x-forwarded-for"] || "").trim();
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return (
    String(req.ip || "").trim() ||
    String(req.socket?.remoteAddress || "").trim() ||
    "unknown"
  );
}

function enforceJozChatRateLimit(req, sessionKey, latestUserMessage) {
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

// ✅ Universal CORS setup — works for DreamHost frontend + Vercel backend
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // or "https://meetjoz.com"
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // respond immediately to preflight (OPTIONS) requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

app.use(cors());
app.use(express.json());

// --- Test route ---
app.get("/api/hello", (req, res) => {
  res.json({ message: "Backend is connected and running!" });
});

// === FILE PERSISTENCE SETUP ===
const MEMORY_FILE = path.resolve("./worldMemory.json");
let worldMemory = {};
let worldMap = {};

// 🔹 Load memory
try {
  if (fs.existsSync(MEMORY_FILE)) {
    const raw = fs.readFileSync(MEMORY_FILE, "utf8");
    worldMemory = JSON.parse(raw);
    console.log(`💾 Loaded ${Object.keys(worldMemory).length} worldMemory objects`);
  } else {
    console.log("🆕 No existing world memory, starting fresh");
  }
} catch (err) {
  console.error("⚠️ Failed to load world memory:", err);
}

// 🔹 Save helper
function saveWorldMemory() {
  if (!canPersistToLocalDisk) {
    console.log("💾 Skipping worldMemory save on ephemeral host");
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
  worldMap = req.body.worldMap || {};
  mergeWorldMapIntoMemory(worldMap);
  if (canPersistToLocalDisk) saveWorldMemory();
  console.log("🌍 Updated worldMap with", Object.keys(worldMap).length, "entries");
  res.json({ success: true });
});

app.get("/api/world-map", (req, res) => res.json(worldMap));

// ------------------------------------------------------------
// 2️⃣ World Memory Storage
// ------------------------------------------------------------
app.post("/api/world-memory", (req, res) => {
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

app.get("/api/world-memory", (req, res) => res.json(worldMemory));

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
    const canonicalWorldReply = buildMeetJozWorldAwarenessReply({
      input,
      appContext: snapshot.validatedAppContext,
      legacyContext: snapshot,
    });
    let proposal = null;

    if (process.env.OPENAI_API_KEY) {
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
    logWorldAwarenessTrace("/api/agentic", trace);

    return res.json({
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
      snapshot,
      trace,
    });
  } catch (error) {
    console.error("❌ /api/agentic failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------------------------
// 3️⃣ AI Reasoning Endpoint
// ------------------------------------------------------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
      (callbackRequestId && (email || phone)) ||
      email ||
      phone
  );
}

function getPrivacyRuntimeInfo() {
  return {
    retentionDays: {
      conversations: JOZ_CONVERSATION_RETENTION_DAYS,
      callbackRequests: JOZ_CALLBACK_RETENTION_DAYS,
      privacyRequests: JOZ_PRIVACY_REQUEST_RETENTION_DAYS,
    },
    processors: [
      "Supabase",
      "OpenAI",
      "Resend",
    ],
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
          "Provide conversationId and sessionKey, or callbackRequestId plus email/phone, or a matching email/phone.",
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
          "Provide conversationId and sessionKey, or callbackRequestId plus email/phone, or a matching email/phone.",
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

    const route = routeJozLlmQuery({
      input: latestUserMessage,
      appContext: validatedAppContext,
      legacyContext: legacyRuntimeContext,
    });
    const intentMode =
      String(context?.intentMode || "").trim().toLowerCase() ||
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
    const retrievedDocuments = await getJozDocumentsByIntent(
      retrievalIntentMode,
      8,
      latestUserMessage
    );
    const retrievalContext = retrievedDocuments.map((doc) => ({
      title: doc.title,
      category: doc.category,
      summary: doc.summary,
      body: doc.body,
      metadata: doc.metadata,
    }));

    const roleAwareContext = buildRoleAwareJozContext({
      buildJozLlmContext,
      profile,
      context,
      intentMode: retrievalIntentMode,
      retrievedDocuments: retrievalContext,
    });
    const ownedResolution = composeJozLlmRouteReply({
      route,
      input: latestUserMessage,
      appContext: validatedAppContext,
      legacyContext: legacyRuntimeContext,
    });
    const resolution =
      ownedResolution ||
      (await resolveUnknownJozReply({
        input: latestUserMessage,
        messages,
        openai,
        roleAwareContext,
      }));

    assertNoFallbackHijack(route, resolution);

    let reply = String(resolution?.reply || "").trim();
    if (!reply) {
      reply = enforceJozLlmReplyLimit("", 55);
    }

    const trace = buildJozRouteTrace(route, resolution);
    logWorldAwarenessTrace("/api/joz-llm", trace);

    if (conversationId) {
      await appendJozMessage({
        conversationId,
        role: "user",
        content: latestUserMessage,
        metadata: { intentMode, route: route.selectedRoute },
      });
      await appendJozMessage({
        conversationId,
        role: "assistant",
        content: reply,
        metadata: {
          intentMode,
          route: route.selectedRoute,
          retrievedCategories:
            resolution?.retrievedCategories?.length
              ? resolution.retrievedCategories
              : retrievedDocuments.map((doc) => doc.category),
          trace,
        },
      });
    }

    return res.json({
      reply,
      conversationId,
      intentMode,
      actions: Array.isArray(resolution?.actions) ? resolution.actions : [],
      retrievedCategories:
        resolution?.retrievedCategories?.length
          ? resolution.retrievedCategories
          : retrievedDocuments.map((doc) => doc.category),
      mode: route.selectedRoute,
      trace,
    });
  } catch (error) {
    console.error("❌ /api/joz-llm failed:", error);
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
    const consent = {
      submitted: req.body?.privacyConsent === false ? false : true,
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

    if (!consent.submitted) {
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
