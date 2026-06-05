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

const SITE_TARGETS = {
  maxx: "/neo/maxx",
  meetJoz: "/neo/meet-joz",
};

const KNOWN_ACTIONS = new Set([
  "brain",
  "ball",
  "vibe",
  "discover",
  "skills",
  "pause",
  "resume",
  "back",
  "vibe_back",
  "vibe_back1",
  "n2x_pause",
  "n2x_resume",
  "launch_in_space_n2x",
  "launch_in_space_workf",
  "hide_contact_buttons",
  "show_contact_buttons",
  "contact_joz",
  "call_joz",
]);

function safeTarget(value) {
  return (
    typeof value === "string" &&
    (value.startsWith("/") || value.startsWith("mailto:") || value.startsWith("tel:"))
  )
    ? value
    : null;
}

function normalizeMeshName(mesh) {
  const lower = String(mesh || "").toLowerCase().trim();
  if (!lower) return "";
  if (/(^|\b)(vibe|flex)(\b|$)/.test(lower)) return "vibe";
  if (/(^|\b)(discover|ascend)(\b|$)/.test(lower)) return "discover";
  if (/(^|\b)(skills|mogg)(\b|$)/.test(lower)) return "skills";
  return lower;
}

function canonicalTargetForMesh(mesh) {
  switch (mesh) {
    case "brain":
    case "enter_portal":
    case "vibe":
      return SITE_TARGETS.maxx;
    case "ball":
      return SITE_TARGETS.meetJoz;
    default:
      return null;
  }
}

function normalizeAction(action) {
  const lower = String(action || "").toLowerCase().trim();
  if (!lower) return null;
  if (lower === "flex") return "vibe";
  if (lower === "ascend") return "discover";
  if (lower === "mogg") return "skills";
  return KNOWN_ACTIONS.has(lower) ? lower : null;
}

function classifyRootCommand(clean) {
  if (/\b(enter|explore|go inside|step inside|open portal|open the flex|open maxx|open max)\b/.test(clean)) {
    return { action: "brain", target: SITE_TARGETS.maxx };
  }

  if (/\b(meet joz|neo meet joz|talk to joz|open ball|go to ball|open meet joz)\b/.test(clean)) {
    return { action: "ball", target: SITE_TARGETS.meetJoz };
  }

  return null;
}

function classifyMeetJozCommand(clean, currentMesh) {
  const mesh = normalizeMeshName(currentMesh);

  if (/\b(vibe|flex|open flex|show flex)\b/.test(clean)) {
    return { action: mesh === "vibe" ? null : "vibe", target: null };
  }

  if (/\b(discover|ascend|open ascend|show ascend)\b/.test(clean)) {
    if (mesh === "vibe") {
      return {
        action: null,
        target: null,
        awareness: "Ascend opens only by interaction, not voice.",
      };
    }
    return { action: "discover", target: null };
  }

  if (/\b(skills|mogg|show mogg|open mogg|show skills|open skills)\b/.test(clean)) {
    if (mesh !== "skills") {
      return {
        action: null,
        target: null,
        awareness: "Mogg opens only from Ascend via click, not voice.",
      };
    }
    return { action: null, target: null };
  }

  if (/\b(back|go back|previous|step back|return)\b/.test(clean)) {
    if (mesh === "skills") return { action: "vibe_back1", target: null };
    if (mesh === "discover") return { action: "vibe_back", target: null };
    if (mesh === "vibe") return { action: "vibe_back", target: "/" };
    return { action: "vibe_back", target: null };
  }

  if (/\b(pause|stop)\b/.test(clean)) return { action: "pause", target: null };
  if (/\b(play|resume|continue)\b/.test(clean)) return { action: "resume", target: null };
  if (/\b(exit|leave|close joz|exit joz)\b/.test(clean)) return { action: "back", target: "/" };
  if (/\b(launch in space|open in space|view in ar|launch ar|view in space|show in space)\b/.test(clean)) {
    return { action: "launch_in_space_workf", target: null };
  }

  return null;
}

app.post("/api/think", async (req, res) => {
  try {
    const { transcript, currentPortal = "root", currentMesh = null } = req.body;
    if (!transcript) return res.status(400).json({ error: "Missing transcript" });

    const clean = transcript.toLowerCase().trim();
    console.log("🎙️ Reasoning about:", clean, "inside portal:", currentPortal);

    if (currentPortal === "root") {
      const match = classifyRootCommand(clean);
      if (match) {
        console.log("🧠 Root voice → canonical route", match);
        return res.json(match);
      }
    }

// --- ✉️ Direct voice command: Contact or Email Joz ---
if (
  /\b(contact|email|message|send (an )?email|reach out|write to)\b/.test(clean)
) {
  console.log("📧 Voice → Contact Joz (mailto:joz@neomaxxing.com)");
  return res.json({
    action: "contact_joz",
    target: "mailto:joz@neomaxxing.com?subject=Hey%20Joz&body=Hi%20Joz%2C%20I%20just%20checked%20out%20your%20work!%20",
    awareness: "Opening your email app to contact Joz at joz@neomaxxing.com."
  });
}

// --- 📞 Direct voice command: Call Joz ---
if (/\b(call|phone|ring|dial|call joz|phone joz)\b/.test(clean)) {
  console.log("📞 Voice → Call Joz");
  return res.json({
    action: "call_joz",
    target: "tel:+41764973894", // update this number
    awareness: "Tap here to call Joz"
  });
}


// --- 🧹 Voice: Hide or Show contact buttons ---
if (/\b(remove|hide|close|dismiss)\b.*\b(contact|button|buttons)\b|\bhide contact\b|\bhide buttons\b/.test(clean)) {
  console.log("🧹 Voice → Hide contact buttons");
  return res.json({
    action: "hide_contact_buttons",
    target: null,
    awareness: "Contact button hidden. Say 'show contact' to bring it back."
  });
}

if (/\b(show|bring back|display|open)\b.*\b(contact|button|buttons)\b|\bshow contact\b|\bshow buttons\b/.test(clean)) {
  console.log("✨ Voice → Show contact buttons");
  return res.json({
    action: "show_contact_buttons",
    target: null,
    awareness: "Contact button visible again."
  });
}

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

    if (currentPortal === "meet-joz") {
      const match = classifyMeetJozCommand(clean, currentMesh);
      if (match) {
        console.log("🧠 meet-joz voice → canonical route", match);
        return res.json(match);
      }
    }

    if (currentPortal === "the-vibe-energy") {
  if (/\b(launch in space|open in space|view in ar|launch ar)\b/.test(clean)) {
    console.log("🚀 Voice → Launch AR for n2x.glb in the-vibe-energy");
    return res.json({ action: "launch_in_space_n2x", target: null });
  }
}

    // --- global back ---
  // --- handle AR launch before back ---
if (/\b(launch in space|open in space|view in ar|view in space|launch ar|show in space)\b/.test(clean)) {
  if (currentPortal === "the-vibe-energy") {
    console.log("🚀 Voice → Launch AR for neurovibes.glb in the-vibe-energy");
    return res.json({ action: "launch_in_space_n2x", target: null });
  }
  if (currentPortal === "meet-joz") {
    console.log("🚀 Voice → Launch AR for Joz.glb in meet-joz");
    return res.json({ action: "launch_in_space_workf", target: null });
  }
}

// --- global exit from portal ---
if (/\b(exit|leave portal|close portal|exit joz|leave joz)\b/.test(clean)) {
  console.log("🚪 Voice → Exit meet-joz → /");
  return res.json({ action: "back", target: "/" });
}

// --- fallback back for root-level navigation ---
if (/\b(back|go back|return|leave)\b/.test(clean) && currentPortal === "root") {
  console.log("↩️ Voice → Root-level back (ignored)");
  return res.json({ action: null, target: null });
}

    // --- world memory match ---
    for (const [mesh, data] of Object.entries(worldMemory)) {
      const cmds = (data.commands || []).map((c) => c.toLowerCase());
      if (cmds.some((cmd) => new RegExp(`\\b${cmd}\\b`, "i").test(clean))) {
        const normalizedMesh = normalizeMeshName(mesh);
        if ((normalizedMesh === "vibe" || mesh === "brain" || mesh === "enter_portal") && currentPortal === "root") {
          console.log("🧭 Ignoring stale root world-memory route for:", mesh);
          return res.json({ action: null, target: null });
        }
        const action = normalizeAction(mesh) || mesh;
        const target = canonicalTargetForMesh(mesh) || safeTarget(data.context?.target);
        console.log(`🎯 Match: "${clean}" → ${mesh}`, { action, target });
        return res.json({ action, target });
      }
    }

    // --- fallback to LLM ---
    const prompt = `
You are a reasoning agent for a 3D interactive world.
Current portal: "${currentPortal}"
Current mesh: "${currentMesh || "none"}"
User said: "${transcript}"

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
    res.json({ action, target });
  } catch (err) {
    console.error("❌ Reasoning failed:", err);
    res.status(500).json({ error: err.message });
  }
});



const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
