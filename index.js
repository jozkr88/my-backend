import express from "express";
import cors from "cors";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { getPortalTransition, initDatabase, isDatabaseEnabled, logReasoningEvent } from "./db.js";
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


dotenv.config();

await initDatabase();

const app = express();

// ✅ Universal CORS setup — works for DreamHost frontend + Vercel backend
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // or "https://neomaxxing.com"
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
  if (process.env.VERCEL) {
    console.log("💾 Skipping worldMemory save on Vercel (read-only)");
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
  if (!process.env.VERCEL) saveWorldMemory();
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

  if (!process.env.VERCEL) saveWorldMemory();
  console.log(`🌍 Learned about "${mesh}" →`, worldMemory[mesh]);
  res.json({ success: true, memory: worldMemory });
});

app.get("/api/world-memory", (req, res) => res.json(worldMemory));

// ------------------------------------------------------------
// 3️⃣ AI Reasoning Endpoint
// ------------------------------------------------------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

app.post("/api/think", async (req, res) => {
  const startedAt = performance.now();
  const sendThinkResult = (payload, source = "unknown") => {
    const backendSeconds = Number(((performance.now() - startedAt) / 1000).toFixed(2));
    console.log(`⏱️ /api/think ${source}: ${backendSeconds}s`);
    return res.json({
      ...payload,
      timing: {
        backendSeconds,
        source,
      },
    });
  };

  try {
    const { transcript, currentPortal = "root", currentMesh = null } = req.body;
    if (!transcript) return res.status(400).json({ error: "Missing transcript" });

    const clean = normalizeTranscript(transcript);
    console.log("🎙️ Reasoning about:", transcript, "→", clean, "inside portal:", currentPortal);

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

    const maxxMatch = currentPortal === "the-vibe-energy" ? classifyMaxxCommand(clean) : null;
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
    const prompt = `
You are a reasoning agent for a 3D interactive world.
App context: ${JSON.stringify(APP_CONTEXT)}
Current portal: "${currentPortal}"
Current mesh: "${currentMesh || "none"}"
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
- In the MAXX portal, Human Neuron and AI Neuron belong to n2x.glb, Spatial Capability is an interaction surface, the neurodesign layer contains The Elite Beauty, Ascension, and 10/10 Frame Mogg, and desktop pause/play toggles between neurodesign and n2x.
- In meet-joz, worldx.glb is the surrounding semantic world and is not interactive, model1.glb is the main interactive object, Ascend/Discover is the clout-scale-heart-prestige layer, Skills/Mogg is the deeper work-capability layer, and back actions can visually unwind the sequence toward root.
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



const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
