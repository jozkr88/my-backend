import express from "express";
import cors from "cors";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  appendJozMessage,
  createJozConversation,
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
  buildJozLlmContext,
  enforceJozLlmReplyLimit,
  buildJozLlmFallbackReply,
  buildJozLlmSystemPrompt,
} from "./shared/jozLlmProfile.js";


dotenv.config();

await initDatabase();

const app = express();
const isEphemeralFilesystem =
  process.env.VERCEL === "1" ||
  process.env.VERCEL === "true" ||
  Boolean(process.env.RENDER) ||
  process.env.DISABLE_FILE_MEMORY === "1";
const canPersistToLocalDisk = !isEphemeralFilesystem;

function isJozEducationQuestion(message = "") {
  const clean = String(message || "").trim().toLowerCase();
  return [
    "course",
    "courses",
    "certification",
    "certifications",
    "education",
    "study",
    "studies",
    "studied",
    "school",
    "schools",
    "academic",
    "academics",
    "qualification",
    "qualifications",
    "degree",
    "degrees",
    "master",
    "university",
    "mit",
    "ideo",
    "hpi",
    "wwdc",
    "apple design labs",
  ].some((term) => clean.includes(term));
}

function isWeakEducationReply(reply = "") {
  const clean = String(reply || "").trim().toLowerCase();
  return [
    "does not specify",
    "not specify",
    "not specified",
    "not available",
    "information is unavailable",
    "recommend reaching out directly",
    "contact him directly",
    "contact joz directly",
  ].some((term) => clean.includes(term));
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
    const currentPortal = context?.currentPortal || context?.portal || "root";
    const structuredPortalKey = currentPortal === "maxx" ? "the-vibe-energy" : currentPortal;
    const currentStateKey = inferStructuredStateKey(currentPortal, context?.currentMesh || context?.mesh || null);
    const structuredState = currentStateKey ? await getStructuredWorldState(structuredPortalKey, currentStateKey) : null;

    if (!input) {
      return res.status(400).json({ error: "Missing input" });
    }

    const enrichedContext = {
      ...context,
      structuredState,
      structuredAvailableActions: structuredState?.availableActions || [],
      allowedActions: context?.allowedActions || structuredState?.availableActions || [],
      knownInteractiveMeshes:
        context?.knownInteractiveMeshes ||
        structuredState?.objects?.map((entry) => entry.mesh).filter(Boolean) ||
        [],
    };
    const snapshot = buildAgentSnapshot({ input, context: enrichedContext, worldMap, worldMemory });
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
    const reply = proposal?.response || buildFallbackAgentReply({ approved, snapshot });

    return res.json({
      intent: String(proposal?.intent || approved?.action || "").trim() || "noop",
      response: reply,
      params: {
        action: approved?.action || null,
        target: approved?.target || null,
        awareness: approved?.awareness || null,
        source: approved?.source || "agent_noop",
      },
      approvedAction: approved?.action || null,
      approvedTarget: approved?.target || null,
      approvedAwareness: approved?.awareness || null,
      snapshot,
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

function inferJozIntentMode(message = "") {
  const clean = String(message || "").trim().toLowerCase();
  if (
    clean.includes("book") ||
    clean.includes("call") ||
    clean.includes("email") ||
    clean.includes("contact")
  ) {
    return "booking";
  }
  if (
    clean.includes("mindset") ||
    clean.includes("philosophy") ||
    clean.includes("how do you think") ||
    clean.includes("systems thinking")
  ) {
    return "mindset";
  }
  if (
    clean.includes("business need") ||
    clean.includes("what i want to build") ||
    clean.includes("problem") ||
    clean.includes("opportunity")
  ) {
    return "business_need";
  }
  if (
    clean.includes("skills") ||
    clean.includes("fit") ||
    clean.includes("time-series") ||
    clean.includes("timeseries") ||
    clean.includes("signal") ||
    clean.includes("anomaly") ||
    clean.includes("digital twin")
  ) {
    return "skills";
  }
  return "skills";
}

app.post("/api/joz-llm", async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const context = req.body?.context || {};
    const sessionKey = String(req.body?.conversationId || req.body?.sessionKey || "").trim() || null;
    const latestUserMessage =
      [...messages].reverse().find((entry) => entry?.role === "user")?.content || "";

    if (!String(latestUserMessage || "").trim()) {
      return res.status(400).json({ error: "Missing user message" });
    }

    const intentMode =
      String(context?.intentMode || "").trim().toLowerCase() ||
      inferJozIntentMode(latestUserMessage);
    const profile = await getPrimaryJozProfile();
    const retrievedDocuments = await getJozDocumentsByIntent(intentMode, 8);
    const retrievalContext = retrievedDocuments.map((doc) => ({
      title: doc.title,
      category: doc.category,
      summary: doc.summary,
      body: doc.body,
      metadata: doc.metadata,
    }));

    const roleAwareContext = {
      ...buildJozLlmContext(),
      runtime: {
        currentPortal: context?.currentPortal || "root",
        currentMesh: context?.currentMesh || null,
        currentMeshStage: context?.currentMeshStage || null,
        targetRole: context?.targetRole || "Advanced Data Scientist",
        intentMode,
      },
      profile,
      retrievedDocuments: retrievalContext,
    };

    let reply = "";
    const conversationId = await createJozConversation({
      profileId: profile?.id,
      sessionKey,
      intentMode,
      context: {
        currentPortal: context?.currentPortal || "root",
        currentMesh: context?.currentMesh || null,
        currentMeshStage: context?.currentMeshStage || null,
      },
    });

    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.35,
          max_tokens: 90,
          messages: [
            {
              role: "system",
              content: buildJozLlmSystemPrompt(),
            },
            {
              role: "system",
              content: JSON.stringify(roleAwareContext),
            },
            ...messages.slice(-8).map((entry) => ({
              role: entry.role === "assistant" ? "assistant" : "user",
              content: String(entry.content || ""),
            })),
          ],
        });

        reply = String(response.choices?.[0]?.message?.content || "").trim();
      } catch (error) {
        console.error("⚠️ /api/joz-llm model call failed:", error?.message || error);
      }
    }

    if (!reply) {
      reply = buildJozLlmFallbackReply(latestUserMessage);
    }

    if (isJozEducationQuestion(latestUserMessage) && isWeakEducationReply(reply)) {
      reply = buildJozLlmFallbackReply(latestUserMessage);
    }

    reply = enforceJozLlmReplyLimit(reply, 55);

    if (conversationId) {
      await appendJozMessage({
        conversationId,
        role: "user",
        content: latestUserMessage,
        metadata: { intentMode },
      });
      await appendJozMessage({
        conversationId,
        role: "assistant",
        content: reply,
        metadata: {
          intentMode,
          retrievedCategories: retrievedDocuments.map((doc) => doc.category),
        },
      });
    }

    return res.json({
      reply,
      conversationId,
      intentMode,
      retrievedCategories: retrievedDocuments.map((doc) => doc.category),
      mode: process.env.OPENAI_API_KEY ? "model_or_fallback" : "fallback",
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
    const { transcript, currentPortal = "root", currentMesh = null, agentContext = null } = req.body;
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
