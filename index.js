import express from "express";
import cors from "cors";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();

// ✅ Universal CORS setup — works for DreamHost frontend + Vercel backend
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // or "https://madebyjoz.com"
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
  console.log("🌍 Updated worldMap with", Object.keys(worldMap).length, "entries");
  res.json({ success: true });
});

Object.entries(worldMap).forEach(([mesh, info]) => {
  if (!worldMemory[mesh]) worldMemory[mesh] = { commands: [] };
  worldMemory[mesh] = {
    ...worldMemory[mesh],
    ...info,
    commands: [...new Set([...(worldMemory[mesh].commands || []), ...(info.commands || [])])],
    lastUpdated: new Date().toISOString(),
  };
});

if (!process.env.VERCEL) saveWorldMemory();

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

// 🧠 Track local portal states (non-persistent)
const portalState = {
  "meet-joz": "vibe",
};

app.post("/api/think", async (req, res) => {
  try {
    const { transcript, currentPortal = "root" } = req.body;
    if (!transcript) return res.status(400).json({ error: "Missing transcript" });

    const clean = transcript.toLowerCase().trim();
    console.log("🎙️ Reasoning about:", clean, "inside portal:", currentPortal);

    // --- the-vibe-energy logic ---
    if (currentPortal === "the-vibe-energy") {
      if (/\b(pause|stop|pause neurons|stop neurons|pause animation|stop animation)\b/.test(clean)) {
        console.log("⏸️ Voice → Pause neurons (n2x)");
        return res.json({ action: "n2x_pause", target: null });
      }
      if (/\b(play|resume|continue|start|resume neurons|play neurons|start neurons|resume animation|play animation)\b/.test(clean)) {
        console.log("▶️ Voice → Resume neurons (n2x)");
        return res.json({ action: "n2x_resume", target: null });
      }
      if (/\b(back|exit|leave|return|go back)\b/.test(clean)) {
        console.log("🚪 Voice → Exit the-vibe-energy → /");
        return res.json({ action: "back", target: "/" });
      }
    }

    if (!global.portalState) global.portalState = { "meet-joz": "vibe" };
    const state = global.portalState["meet-joz"];

    // --- meet-joz logic ---
    if (currentPortal === "meet-joz") {
      if (/\bvibe\b/.test(clean)) return res.json({ action: "vibe", target: null });
      if (/\bdiscover\b/.test(clean)) return res.json({ action: "discover", target: null });
      if (/\b(skills|show skills|open skills)\b/.test(clean)) return res.json({ action: "skills", target: null });
      if (/\b(pause|stop)\b/.test(clean)) return res.json({ action: "pause", target: null });
      if (/\b(play|resume|continue)\b/.test(clean)) return res.json({ action: "resume", target: null });
      if (/\b(exit|leave|close joz|exit joz)\b/.test(clean)) return res.json({ action: "back", target: "/" });
    }

    // --- global back ---
    if (["back", "go back", "exit", "return"].some((cmd) => clean.includes(cmd))) {
      return res.json({ action: "back", target: currentPortal === "root" ? null : "/" });
    }

    // --- world memory match ---
    for (const [mesh, data] of Object.entries(worldMemory)) {
      const cmds = (data.commands || []).map((c) => c.toLowerCase());
      if (cmds.some((cmd) => new RegExp(`\\b${cmd}\\b`, "i").test(clean))) {
        if (mesh === "vibe" && currentPortal === "root") {
          console.log("🧭 Ignoring 'vibe' from root");
          return res.json({ action: null, target: null });
        }
        console.log(`🎯 Match: "${clean}" → ${mesh}`);
        return res.json({ action: mesh, target: data.context?.target || null });
      }
    }

    // --- fallback to LLM ---
    const prompt = `
You are a reasoning agent for a 3D interactive world.
Current portal: "${currentPortal}"
User said: "${transcript}"
Return JSON like: { "action": "<mesh>", "target": "<path or null>" }
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
    res.json({ action: parsed.action?.toLowerCase?.() || null, target: parsed.target || null });
  } catch (err) {
    console.error("❌ Reasoning failed:", err);
    res.status(500).json({ error: err.message });
  }
});



export default app;
