import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getJozLaneConfig, normalizeJozLaneIntent } from "./shared/jozLlmLanes.js";
import { rankJozDocumentsForQuery } from "./shared/jozOntology.js";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool = null;
let publishedJozDocsCache = null;

const MODEL_READY_STATUSES = new Set([
  "verified",
  "cv_supported",
  "project_supported",
  "capability_supported",
  "positioning_supported",
  "framework_supported",
  "cv_and_project_supported",
]);

function resolvePublishedJozDocsPath() {
  const candidates = [
    path.join(process.cwd(), "data", "joz", "published", "joz-documents.generated.json"),
    path.join(__dirname, "..", "data", "joz", "published", "joz-documents.generated.json"),
    path.join(__dirname, "data", "joz", "published", "joz-documents.generated.json"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

function loadPublishedJozDocuments() {
  if (publishedJozDocsCache) return publishedJozDocsCache;
  const docsPath = resolvePublishedJozDocsPath();
  if (!fs.existsSync(docsPath)) {
    publishedJozDocsCache = [];
    return publishedJozDocsCache;
  }

  const published = JSON.parse(fs.readFileSync(docsPath, "utf8"));
  if (Array.isArray(published?.model_ready_records)) {
    publishedJozDocsCache = published.model_ready_records;
    return publishedJozDocsCache;
  }

  const records = Array.isArray(published?.records) ? published.records : [];
  publishedJozDocsCache = records.filter((record) =>
    MODEL_READY_STATUSES.has(
      String(
        record?.metadata?.verification_status ||
          record?.metadata?.verification?.status ||
          ""
      ).trim().toLowerCase()
    )
  );
  return publishedJozDocsCache;
}

function getDatabaseUrl() {
  return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
}

function normalizeJozDocumentRow(row = {}) {
  return {
    title: row.title,
    category: row.category,
    summary: row.summary,
    body: row.body,
    metadata: {
      ...(row.metadata || {}),
      slug: row.slug || row?.metadata?.slug || null,
      visibility: row.visibility || row?.metadata?.visibility || "public",
      publish_version: row.publish_version || row?.metadata?.publish_version || null,
    },
  };
}

function normalizePrivacyEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizePrivacyPhone(value = "") {
  return String(value || "").replace(/\D+/g, "");
}

const TRANSITION_SEED = [
  ["meet-joz", "vibe", "flex", "vibe", null, "Opening Ascend."],
  ["meet-joz", "discover", "ascend", "discover", null, "Opening Ascend."],
  ["meet-joz", "discover", "mogg", "skills", null, "Opening Mogg."],
  ["meet-joz", "skills", "mogg", "skills", null, "Opening Mogg."],
  ["meet-joz", "vibe", "back", "vibe_back", "/"],
  ["meet-joz", "discover", "back", "vibe_back", null],
  ["meet-joz", "skills", "back", "vibe_back1", null],
  ["meet-joz", "vibe", "pause", "pause", null],
  ["meet-joz", "discover", "pause", "pause", null],
  ["meet-joz", "skills", "pause", "pause", null],
  ["meet-joz", "vibe", "resume", "resume", null],
  ["meet-joz", "discover", "resume", "resume", null],
  ["meet-joz", "skills", "resume", "resume", null],
  ["meet-joz", "vibe", "exit", "back", "/"],
  ["meet-joz", "discover", "exit", "back", "/"],
  ["meet-joz", "skills", "exit", "back", "/"],
  ["meet-joz", "vibe", "launch", "launch_in_space_workf", null],
  ["meet-joz", "discover", "launch", "launch_in_space_workf", null],
  ["meet-joz", "skills", "launch", "launch_in_space_workf", null],
];

const WORLD_MODEL_SEED = {
  portals: [
    ["root", "Root", "/", "Landing world with two primary portals."],
    ["meet-joz", "Meet Joz", "/neo/meet-joz", "Career and identity world with layered interactions."],
    ["the-vibe-energy", "Neo Maxx", "/neo/maxx", "Inside-the-brain world with neuron and neurodesign states."],
  ],
  states: [
    ["root", "root", "Root", "Root landing state.", true],
    ["meet-joz", "vibe", "Vibe", "Entry layer in Meet Joz with the desktop worldx surround, the mobile golden environment, and the central capsule focal object.", true],
    ["meet-joz", "discover", "Discover", "Ascend and discovery layer with Clout MAXX, Scale MAXX, the heart construct, Alpha PSL, World-Class, and Atmos MAXX.", false],
    ["meet-joz", "skills", "Skills", "Deeper capability layer with Cross-Sensory Aura Engineering, Maximize Beauty Change Reality, AI Synthesis, AI Analysis, and Signature motifs.", false],
    ["the-vibe-energy", "brain_entry", "Brain Entry", "Early entry phase before the main neuron explainer captions appear.", true],
    ["the-vibe-energy", "signal_flow", "Signal Flow", "Phase where neurotransmitters send signals between neurons.", false],
    ["the-vibe-energy", "new_pathways", "New Pathways", "Phase where repeated experiences stabilize new pathways.", false],
    ["the-vibe-energy", "memory_building", "Memory Building", "Later explainer phase where the scene reinforces memory and experience formation.", false],
    ["the-vibe-energy", "inside_the_brain", "Inside the Brain", "Secondary abstract inside-the-brain layer visible after pausing the neuron explainer.", false],
  ],
  actions: [
    ["brain", "brain", "navigation", "Open the brain portal."],
    ["ball", "ball", "navigation", "Open the Meet Joz portal."],
    ["vibe", "vibe", "interaction", "Open the vibe/flex layer."],
    ["discover", "discover", "interaction", "Open the discover/ascend layer."],
    ["skills", "skills", "interaction", "Open the skills/mogg layer."],
    ["pause", "pause", "utility", "Pause the current animated layer."],
    ["resume", "resume", "utility", "Resume the current animated layer."],
    ["back", "back", "navigation", "Go back one world level."],
    ["vibe_back", "vibe_back", "navigation", "Step back from discover to vibe."],
    ["vibe_back1", "vibe_back1", "navigation", "Step back from skills to discover."],
    ["launch_in_space_workf", "launch_in_space_workf", "ar", "Launch Meet Joz content in space."],
    ["n2x_pause", "n2x_pause", "utility", "Pause the neuron motion in Neo Maxx."],
    ["n2x_resume", "n2x_resume", "utility", "Resume the neuron motion in Neo Maxx."],
    ["launch_in_space_n2x", "launch_in_space_n2x", "ar", "Launch Neo Maxx in space."],
  ],
  objects: [
    ["root", "brain", "brain", "Brain Portal", "Portal into Neo Maxx.", "/neo/maxx", "brain"],
    ["root", "ball", "ball", "Meet Joz Portal", "Portal into Meet Joz.", "/neo/meet-joz", "ball"],
    ["meet-joz", "vibe", "vibe", "Vibe", "Entry progression into the Meet Joz world.", null, "vibe"],
    ["meet-joz", "discover", "discover", "Discover", "Ascend progression with prestige, clout, scale, and destination panels.", null, "discover"],
    ["meet-joz", "skills", "skills", "Skills", "Deeper capability progression with aura, AI, and transformation motifs.", null, "skills"],
    ["meet-joz", "worldx_desktop", "worldx desktop", "Worldx Desktop", "The reflective desktop surrounding world of Meet Joz. It frames the portal but is not the primary interactive trigger.", null, "vibe"],
    ["meet-joz", "golden_environment_mobile", "golden environment", "Golden Environment", "The mobile surrounding environment used instead of the desktop worldx scene.", null, "vibe"],
    ["meet-joz", "capsule", "capsule", "Capsule", "The gold-and-white capsule at the center of the Meet Joz world that acts as the focal trigger object.", null, "vibe"],
    ["meet-joz", "heart", "heart", "Ascend Heart", "The neon heart construct that anchors Ascend with attraction, emotion, and transformation.", null, "discover"],
    ["meet-joz", "clout_maxx", "clout maxx", "Clout MAXX", "Prestige and attention motif inside the Ascend layer.", null, "discover"],
    ["meet-joz", "scale_maxx", "scale maxx", "Scale MAXX", "Scale and growth motif inside the Ascend layer.", null, "discover"],
    ["meet-joz", "alpha_psl", "alpha psl", "Alpha PSL", "Dubai proof-point panel inside the Ascend layer.", null, "discover"],
    ["meet-joz", "world_class", "world class", "World-Class", "Singapore proof-point panel inside the Ascend layer.", null, "discover"],
    ["meet-joz", "atmos_maxx", "atmos maxx", "Atmos MAXX", "Environmental destination panel inside the surrounding Meet Joz world.", null, "discover"],
    ["meet-joz", "cross_sensory_aura_engineering", "cross sensory aura engineering", "Cross-Sensory Aura Engineering", "Aura and aesthetic-engineering phrase cluster inside the deeper capability layer.", null, "skills"],
    ["meet-joz", "maximize_beauty_change_reality", "maximize beauty change reality", "Maximize Beauty Change Reality", "Transformation phrase cluster inside the deeper capability layer.", null, "skills"],
    ["meet-joz", "ai_synthesis", "ai synthesis", "AI Synthesis", "Chrome-node intelligence cluster for synthesis and connection-making.", null, "skills"],
    ["meet-joz", "ai_analysis", "ai analysis", "AI Analysis", "Chrome-node intelligence cluster for analysis and connection-making.", null, "skills"],
    ["meet-joz", "signature", "signature", "Signature", "Signature motif that appears around the deeper capability layer.", null, "skills"],
    ["the-vibe-energy", "neurotransmitters", "neurotransmitters", "Neurotransmitters", "Glossy balls with holes symbolising neurotransmitters moving through the abstract brain environment.", null, "n2x"],
    ["the-vibe-energy", "human_neuron", "human neuron", "Human Neuron", "Human neuron concept inside the abstract brain scene.", null, "n2x"],
    ["the-vibe-energy", "ai_neuron", "ai neuron", "AI Neuron", "AI neuron concept inside the abstract brain scene.", null, "n2x"],
    ["the-vibe-energy", "neurotransmitters", "neurotransmitters", "Neurotransmitters", "Animated signal carriers moving between the neurons in the explainer scene.", null, "n2x"],
    ["the-vibe-energy", "new_pathways", "new pathways", "New Pathways", "The stabilization of new neural pathways explained during the brain sequence.", null, "n2x"],
    ["the-vibe-energy", "voice_ai_agent_maxx", "voice ai agent maxx", "Voice AI Agent MAXX", "The title layer shown at the top of the brain sequence.", null, "n2x"],
    ["the-vibe-energy", "spatial_capability", "spatial capability", "Spatial Capability", "Launches the brain scene in space.", null, "launch_in_space_n2x"],
    ["the-vibe-energy", "inside_the_brain", "inside the brain", "Inside the Brain", "Abstract inside-the-brain layer shown after pausing the neurons explainer.", null, "n2x_pause"],
    ["the-vibe-energy", "elite_beauty", "elite beauty", "The Elite Beauty", "One semantic component inside the neurodesign layer.", null, "n2x_pause"],
    ["the-vibe-energy", "ascension", "ascension", "Ascension", "One semantic component inside the neurodesign layer.", null, "n2x_pause"],
    ["the-vibe-energy", "frame_mogg", "frame mogg", "10/10 Frame Mogg", "One semantic component inside the neurodesign layer.", null, "n2x_pause"],
  ],
  aliases: [
    ["brain", "enter"],
    ["brain", "enter the brain"],
    ["brain", "enter the mind"],
    ["brain", "open the mind"],
    ["brain", "open maxx"],
    ["ball", "meet joz"],
    ["ball", "talk to joz"],
    ["ball", "open meet joz"],
    ["vibe", "flex"],
    ["vibe", "vibe"],
    ["discover", "ascend"],
    ["discover", "discover"],
    ["skills", "mogg"],
    ["skills", "skills"],
    ["worldx_desktop", "worldx"],
    ["worldx_desktop", "worldx desktop"],
    ["worldx_desktop", "desktop world"],
    ["golden_environment_mobile", "golden environment"],
    ["golden_environment_mobile", "golden mobile environment"],
    ["golden_environment_mobile", "mobile golden environment"],
    ["capsule", "capsule"],
    ["capsule", "gold capsule"],
    ["capsule", "white and gold capsule"],
    ["heart", "heart"],
    ["heart", "ascend heart"],
    ["heart", "neon heart"],
    ["clout_maxx", "clout maxx"],
    ["clout_maxx", "clout"],
    ["scale_maxx", "scale maxx"],
    ["scale_maxx", "scale"],
    ["alpha_psl", "alpha psl"],
    ["alpha_psl", "dubai"],
    ["world_class", "world class"],
    ["world_class", "singapore"],
    ["atmos_maxx", "atmos maxx"],
    ["atmos_maxx", "atmos"],
    ["cross_sensory_aura_engineering", "cross sensory aura engineering"],
    ["cross_sensory_aura_engineering", "aura engineering"],
    ["cross_sensory_aura_engineering", "cross sensory aura"],
    ["maximize_beauty_change_reality", "maximize beauty change reality"],
    ["maximize_beauty_change_reality", "beauty change reality"],
    ["maximize_beauty_change_reality", "maximize beauty"],
    ["ai_synthesis", "ai synthesis"],
    ["ai_synthesis", "synthesis"],
    ["ai_analysis", "ai analysis"],
    ["ai_analysis", "analysis"],
    ["signature", "signature"],
    ["neurotransmitters", "neurotransmitters"],
    ["neurotransmitters", "neurons"],
    ["neurotransmitters", "neuron explainer"],
    ["neurotransmitters", "balls with holes"],
    ["human_neuron", "human neuron"],
    ["human_neuron", "human neurons"],
    ["ai_neuron", "ai neuron"],
    ["ai_neuron", "ai neurons"],
    ["neurotransmitters", "signals between the neurons"],
    ["new_pathways", "new pathways"],
    ["new_pathways", "stabilize new pathways"],
    ["voice_ai_agent_maxx", "voice ai agent maxx"],
    ["voice_ai_agent_maxx", "maxx"],
    ["spatial_capability", "spatial capability"],
    ["spatial_capability", "space maxx"],
    ["spatial_capability", "launch in space"],
    ["spatial_capability", "view in space"],
    ["inside_the_brain", "inside the brain"],
    ["inside_the_brain", "abstract brain"],
    ["inside_the_brain", "inside brain"],
    ["elite_beauty", "elite beauty"],
    ["elite_beauty", "the elite beauty"],
    ["ascension", "ascension"],
    ["frame_mogg", "frame mogg"],
    ["frame_mogg", "10 10 frame mogg"],
    ["frame_mogg", "10/10 frame mogg"],
  ],
  stateActions: [
    ["root", "brain"],
    ["root", "ball"],
    ["vibe", "vibe"],
    ["vibe", "pause"],
    ["vibe", "resume"],
    ["vibe", "back"],
    ["vibe", "vibe_back"],
    ["vibe", "launch_in_space_workf"],
    ["discover", "discover"],
    ["discover", "skills"],
    ["discover", "pause"],
    ["discover", "resume"],
    ["discover", "back"],
    ["discover", "vibe_back"],
    ["discover", "launch_in_space_workf"],
    ["skills", "skills"],
    ["skills", "pause"],
    ["skills", "resume"],
    ["skills", "back"],
    ["skills", "vibe_back1"],
    ["skills", "launch_in_space_workf"],
    ["brain_entry", "n2x_pause"],
    ["brain_entry", "n2x_resume"],
    ["brain_entry", "back"],
    ["brain_entry", "launch_in_space_n2x"],
    ["signal_flow", "n2x_pause"],
    ["signal_flow", "n2x_resume"],
    ["signal_flow", "back"],
    ["signal_flow", "launch_in_space_n2x"],
    ["new_pathways", "n2x_pause"],
    ["new_pathways", "n2x_resume"],
    ["new_pathways", "back"],
    ["new_pathways", "launch_in_space_n2x"],
    ["memory_building", "n2x_pause"],
    ["memory_building", "n2x_resume"],
    ["memory_building", "back"],
    ["memory_building", "launch_in_space_n2x"],
    ["inside_the_brain", "n2x_pause"],
    ["inside_the_brain", "n2x_resume"],
    ["inside_the_brain", "back"],
    ["inside_the_brain", "launch_in_space_n2x"],
  ],
  transitions: [
    ["root", "brain", "brain", "/neo/maxx", "Entering the Brain."],
    ["root", "ball", "ball", "/neo/meet-joz", "Opening Meet Joz."],
    ["vibe", "vibe", "vibe", null, "Opening Flex."],
    ["vibe", "pause", "vibe", null, "Pausing the current layer."],
    ["vibe", "resume", "vibe", null, "Resuming the current layer."],
    ["vibe", "back", "root", "/", "Returning to root."],
    ["vibe", "vibe_back", "root", "/", "Returning to root."],
    ["vibe", "launch_in_space_workf", "vibe", null, "Launching in space."],
    ["discover", "discover", "discover", null, "Opening Ascend."],
    ["discover", "skills", "skills", null, "Opening Mogg."],
    ["discover", "pause", "discover", null, "Pausing the current layer."],
    ["discover", "resume", "discover", null, "Resuming the current layer."],
    ["discover", "back", "vibe", null, "Returning to Vibe."],
    ["discover", "vibe_back", "vibe", null, "Returning to Vibe."],
    ["discover", "launch_in_space_workf", "discover", null, "Launching in space."],
    ["skills", "skills", "skills", null, "Opening Mogg."],
    ["skills", "pause", "skills", null, "Pausing the current layer."],
    ["skills", "resume", "skills", null, "Resuming the current layer."],
    ["skills", "back", "discover", null, "Returning to Discover."],
    ["skills", "vibe_back1", "discover", null, "Returning to Discover."],
    ["skills", "launch_in_space_workf", "skills", null, "Launching in space."],
    ["brain_entry", "n2x_pause", "inside_the_brain", null, "Pausing the neurons and revealing the abstract inside-the-brain layer."],
    ["brain_entry", "n2x_resume", "brain_entry", null, "The brain entry scene is already active."],
    ["brain_entry", "back", "root", "/", "Leaving the Brain."],
    ["brain_entry", "launch_in_space_n2x", "brain_entry", null, "Launching the brain scene in space."],
    ["signal_flow", "n2x_pause", "inside_the_brain", null, "Pausing the neurons and revealing the abstract inside-the-brain layer."],
    ["signal_flow", "n2x_resume", "signal_flow", null, "The neurotransmitter signal-flow scene is already active."],
    ["signal_flow", "back", "root", "/", "Leaving the Brain."],
    ["signal_flow", "launch_in_space_n2x", "signal_flow", null, "Launching the brain scene in space."],
    ["new_pathways", "n2x_pause", "inside_the_brain", null, "Pausing the neurons and revealing the abstract inside-the-brain layer."],
    ["new_pathways", "n2x_resume", "new_pathways", null, "The new-pathways scene is already active."],
    ["new_pathways", "back", "root", "/", "Leaving the Brain."],
    ["new_pathways", "launch_in_space_n2x", "new_pathways", null, "Launching the brain scene in space."],
    ["memory_building", "n2x_pause", "inside_the_brain", null, "Pausing the neurons and revealing the abstract inside-the-brain layer."],
    ["memory_building", "n2x_resume", "memory_building", null, "The memory-building scene is already active."],
    ["memory_building", "back", "root", "/", "Leaving the Brain."],
    ["memory_building", "launch_in_space_n2x", "memory_building", null, "Launching the brain scene in space."],
    ["inside_the_brain", "n2x_pause", "inside_the_brain", null, "The abstract inside-the-brain layer is already visible."],
    ["inside_the_brain", "n2x_resume", "signal_flow", null, "Returning to the neurotransmitter scene."],
    ["inside_the_brain", "back", "root", "/", "Leaving the Brain."],
    ["inside_the_brain", "launch_in_space_n2x", "inside_the_brain", null, "Launching the brain scene in space."],
  ],
  phrases: [
    ["root", "brain", "enter the brain"],
    ["root", "brain", "enter the mind"],
    ["root", "brain", "open the mind"],
    ["root", "brain", "open maxx"],
    ["root", "ball", "meet joz"],
    ["root", "ball", "talk to joz"],
    ["root", "ball", "open meet joz"],
    ["vibe", "vibe", "vibe"],
    ["vibe", "vibe", "flex"],
    ["vibe", "pause", "pause"],
    ["vibe", "pause", "stop"],
    ["vibe", "resume", "resume"],
    ["vibe", "resume", "play"],
    ["vibe", "back", "back"],
    ["vibe", "back", "exit"],
    ["vibe", "launch_in_space_workf", "launch in space"],
    ["discover", "discover", "discover"],
    ["discover", "discover", "ascend"],
    ["discover", "skills", "skills"],
    ["discover", "skills", "mogg"],
    ["discover", "pause", "pause"],
    ["discover", "resume", "resume"],
    ["discover", "back", "back"],
    ["discover", "back", "exit"],
    ["discover", "launch_in_space_workf", "launch in space"],
    ["skills", "skills", "skills"],
    ["skills", "skills", "mogg"],
    ["skills", "pause", "pause"],
    ["skills", "resume", "resume"],
    ["skills", "back", "back"],
    ["skills", "back", "exit"],
    ["skills", "launch_in_space_workf", "launch in space"],
    ["brain_entry", "n2x_pause", "pause neurons"],
    ["brain_entry", "n2x_pause", "pause"],
    ["brain_entry", "n2x_pause", "show inside the brain"],
    ["brain_entry", "n2x_pause", "show abstract brain"],
    ["brain_entry", "n2x_resume", "resume neurons"],
    ["brain_entry", "n2x_resume", "play neurons"],
    ["brain_entry", "back", "back"],
    ["brain_entry", "back", "leave the brain"],
    ["brain_entry", "launch_in_space_n2x", "launch in space"],
    ["brain_entry", "launch_in_space_n2x", "space maxx"],
    ["signal_flow", "n2x_pause", "pause neurons"],
    ["signal_flow", "n2x_pause", "pause"],
    ["signal_flow", "n2x_pause", "show inside the brain"],
    ["signal_flow", "n2x_pause", "show abstract brain"],
    ["signal_flow", "n2x_resume", "resume neurons"],
    ["signal_flow", "n2x_resume", "play neurons"],
    ["signal_flow", "back", "back"],
    ["signal_flow", "back", "leave the brain"],
    ["signal_flow", "launch_in_space_n2x", "launch in space"],
    ["signal_flow", "launch_in_space_n2x", "space maxx"],
    ["new_pathways", "n2x_pause", "pause neurons"],
    ["new_pathways", "n2x_pause", "pause"],
    ["new_pathways", "n2x_pause", "show inside the brain"],
    ["new_pathways", "n2x_pause", "show abstract brain"],
    ["new_pathways", "n2x_resume", "resume neurons"],
    ["new_pathways", "n2x_resume", "play neurons"],
    ["new_pathways", "back", "back"],
    ["new_pathways", "back", "leave the brain"],
    ["new_pathways", "launch_in_space_n2x", "launch in space"],
    ["new_pathways", "launch_in_space_n2x", "space maxx"],
    ["memory_building", "n2x_pause", "pause neurons"],
    ["memory_building", "n2x_pause", "pause"],
    ["memory_building", "n2x_pause", "show inside the brain"],
    ["memory_building", "n2x_pause", "show abstract brain"],
    ["memory_building", "n2x_resume", "resume neurons"],
    ["memory_building", "n2x_resume", "play neurons"],
    ["memory_building", "back", "back"],
    ["memory_building", "back", "leave the brain"],
    ["memory_building", "launch_in_space_n2x", "launch in space"],
    ["memory_building", "launch_in_space_n2x", "space maxx"],
    ["inside_the_brain", "n2x_pause", "pause neurons"],
    ["inside_the_brain", "n2x_pause", "show inside the brain"],
    ["inside_the_brain", "n2x_resume", "resume neurons"],
    ["inside_the_brain", "n2x_resume", "play neurons"],
    ["inside_the_brain", "n2x_resume", "show neurotransmitters"],
    ["inside_the_brain", "back", "back"],
    ["inside_the_brain", "back", "leave the brain"],
    ["inside_the_brain", "launch_in_space_n2x", "launch in space"],
    ["inside_the_brain", "launch_in_space_n2x", "space maxx"],
  ],
};

export function isDatabaseEnabled() {
  return Boolean(getDatabaseUrl());
}

function getPool() {
  if (!isDatabaseEnabled()) return null;
  if (pool) return pool;

  pool = new Pool({
    connectionString: getDatabaseUrl(),
    ssl: process.env.NODE_ENV === "production" || process.env.RENDER || process.env.SUPABASE_DB_URL
      ? { rejectUnauthorized: false }
      : false,
  });

  return pool;
}

async function runQuery(text, params = []) {
  const db = getPool();
  if (!db) return { rows: [] };
  return db.query(text, params);
}

export async function getPrimaryJozProfile() {
  const result = await runQuery(
    `SELECT id, slug, display_name, label, headline, summary, website_url, email, phone, location
     FROM joz_profiles
     WHERE is_primary = TRUE
     ORDER BY id ASC
     LIMIT 1`
  );
  return result.rows[0] || null;
}

export async function getJozDocumentsByIntent(intentMode = "skills", limit = 8, query = "") {
  const primaryCategory = normalizeJozLaneIntent(intentMode);
  const lane = getJozLaneConfig(primaryCategory);
  const categories = [
    ...new Set([
      ...(lane?.retrievalCategories || [primaryCategory, "case_study", "proof", "bio", "faq"]),
      "skills",
      "systems_mindset",
      "business_need",
      "systems_principle",
      "governance",
      "governance_principle",
    ]),
  ];
  const laneAliases = [
    ...new Set(
      [
        primaryCategory,
        primaryCategory === "systems_mindset" ? "mindset" : null,
        "skills",
        "systems_mindset",
        "business_need",
      ].filter(Boolean)
    ),
  ];
  const result = await runQuery(
    `SELECT title, category, summary, body, metadata
     FROM joz_documents
     WHERE profile_id = (
         SELECT id
         FROM joz_profiles
         WHERE is_primary = TRUE
         ORDER BY updated_at DESC, id DESC
         LIMIT 1
       )
       AND is_runtime_active = TRUE
       AND visibility = 'public'
       AND (
         category = ANY($1::text[])
         OR COALESCE(metadata->>'lane', '') = ANY($2::text[])
       )
     ORDER BY
       CASE
         WHEN COALESCE(metadata->>'lane', '') = ANY($2::text[]) THEN 0
         WHEN category = $3 THEN 1
         WHEN category = 'proof' THEN 2
         WHEN category = 'bio' THEN 3
         WHEN category = 'faq' THEN 4
         ELSE 5
       END,
       CASE
         WHEN LOWER(COALESCE(metadata->>'verification_status', metadata->'verification'->>'status', '')) IN ('verified', 'cv_supported') THEN 0
         WHEN LOWER(COALESCE(metadata->>'verification_status', metadata->'verification'->>'status', '')) IN ('project_supported', 'capability_supported') THEN 1
         ELSE 2
       END,
       COALESCE((metadata->>'impact_score')::int, 0) DESC,
       CASE LOWER(COALESCE(metadata->>'priority_label', 'standard'))
         WHEN 'hero' THEN 0
         WHEN 'high' THEN 1
         WHEN 'standard' THEN 2
         ELSE 3
       END,
       updated_at DESC,
       id ASC
     LIMIT $4`,
    [categories, laneAliases, primaryCategory, Math.max(limit * 5, 20)]
  );
  const dbDocuments = (result.rows || []).map(normalizeJozDocumentRow);
  const merged = new Map();

  for (const doc of loadPublishedJozDocuments()) {
    const docLane = String(doc?.metadata?.lane || "").trim();
    const docCategory = String(doc?.category || "").trim();
    if (!laneAliases.includes(docLane) && !categories.includes(docCategory)) continue;

    const slug = String(doc?.slug || doc?.metadata?.slug || "").trim();
    if (!slug) continue;

    merged.set(slug, {
      title: doc.title,
      category: doc.category,
      summary: doc.summary,
      body: doc.body,
      metadata: {
        ...(doc.metadata || {}),
        slug,
        visibility: "public",
        publish_version: null,
      },
    });
  }

  for (const doc of dbDocuments) {
    const slug = String(doc?.metadata?.slug || "").trim();
    const fallbackKey = `${doc?.title || ""}::${doc?.category || ""}`;
    merged.set(slug || fallbackKey, doc);
  }

  const sourceDocuments = [...merged.values()];

  return rankJozDocumentsForQuery(sourceDocuments, {
    intentMode: primaryCategory,
    query,
    limit,
  }).map(({ _ranking, ...doc }) => doc);
}

export async function createJozConversation({
  profileId,
  sessionKey = null,
  intentMode = null,
  context = {},
}) {
  if (!profileId) return null;
  const result = await runQuery(
    `INSERT INTO joz_conversations (profile_id, session_key, intent_mode, context, last_message_at)
     VALUES ($1, $2, $3, $4::jsonb, NOW())
     RETURNING id`,
    [profileId, sessionKey, intentMode, JSON.stringify(context || {})]
  );
  return result.rows[0]?.id || null;
}

export async function appendJozMessage({
  conversationId,
  role,
  content,
  messageKind = "chat",
  metadata = {},
}) {
  if (!conversationId || !role || !content) return;
  await runQuery(
    `INSERT INTO joz_messages (conversation_id, role, message_kind, content, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [conversationId, role, messageKind, content, JSON.stringify(metadata || {})]
  );
  await runQuery(
    `UPDATE joz_conversations
     SET last_message_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [conversationId]
  );
}

export async function logJozLlmRequestEvent({
  conversationId = null,
  sessionKey = null,
  route = null,
  intentMode = null,
  userMessage = "",
  assistantReply = "",
  requestContext = {},
  trace = {},
  verification = {},
  retrievedCategories = [],
  retrievedDocuments = [],
  latencyMs = null,
  responseStatus = "ok",
} = {}) {
  const result = await runQuery(
    `INSERT INTO joz_llm_request_events (
       conversation_id,
       session_key,
       route,
       intent_mode,
       user_message,
       assistant_reply,
       request_context,
       trace,
       verification,
       retrieved_categories,
       retrieved_documents,
       latency_ms,
       response_status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13)
     RETURNING id`,
    [
      conversationId,
      sessionKey,
      route,
      intentMode,
      userMessage,
      assistantReply,
      JSON.stringify(requestContext || {}),
      JSON.stringify(trace || {}),
      JSON.stringify(verification || {}),
      JSON.stringify(retrievedCategories || []),
      JSON.stringify(retrievedDocuments || []),
      latencyMs,
      responseStatus,
    ]
  );
  return result.rows[0]?.id || null;
}

export async function listRecentJozLlmRequestEvents(limit = 20) {
  const result = await runQuery(
    `SELECT id, conversation_id, session_key, route, intent_mode, user_message, assistant_reply,
            request_context, trace, verification, retrieved_categories, retrieved_documents,
            latency_ms, response_status, created_at
     FROM joz_llm_request_events
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.max(1, Math.min(100, Number(limit) || 20))]
  );
  return result.rows || [];
}

export async function createJozCallbackRequest({
  conversationId = null,
  profileId = null,
  requestedName,
  requestedPhone,
  requestedTime,
  requestedEmail = null,
  source = "joz_llm",
  payload = {},
  deliveryStatus = "stored_only",
  deliveryChannels = [],
  deliveryErrors = [],
}) {
  const result = await runQuery(
    `INSERT INTO joz_callback_requests (
       conversation_id,
       profile_id,
       requested_name,
       requested_phone,
       requested_time,
       requested_email,
       source,
       payload,
       delivery_status,
       delivery_channels,
       delivery_errors
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11::jsonb)
     RETURNING id`,
    [
      conversationId,
      profileId,
      requestedName,
      requestedPhone,
      requestedTime,
      requestedEmail,
      source,
      JSON.stringify(payload || {}),
      deliveryStatus,
      JSON.stringify(deliveryChannels || []),
      JSON.stringify(deliveryErrors || []),
    ]
  );
  return result.rows[0]?.id || null;
}

export async function createJozPrivacyRequest({
  requestType,
  requestStatus = "received",
  email = null,
  phone = null,
  conversationId = null,
  callbackRequestId = null,
  sessionKey = null,
  source = "web",
  payload = {},
}) {
  const result = await runQuery(
    `INSERT INTO joz_privacy_requests (
       request_type,
       request_status,
       email,
       phone,
       conversation_id,
       callback_request_id,
       session_key,
       source,
       payload
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING id`,
    [
      requestType,
      requestStatus,
      email,
      phone,
      conversationId,
      callbackRequestId,
      sessionKey,
      source,
      JSON.stringify(payload || {}),
    ]
  );
  return result.rows[0]?.id || null;
}

async function resolvePrivacyTargets({
  conversationId = null,
  sessionKey = null,
  callbackRequestId = null,
  email = null,
  phone = null,
} = {}) {
  const normalizedEmail = normalizePrivacyEmail(email);
  const normalizedPhone = normalizePrivacyPhone(phone);
  const conversationIds = new Set();
  const callbackById = new Map();

  if (conversationId && sessionKey) {
    const conversationResult = await runQuery(
      `SELECT id, session_key, visitor_label, channel, intent_mode, lead_status, context, last_message_at, created_at, updated_at
       FROM joz_conversations
       WHERE id = $1
         AND session_key = $2
       LIMIT 1`,
      [conversationId, sessionKey]
    );
    for (const row of conversationResult.rows || []) {
      conversationIds.add(row.id);
    }
  } else if (sessionKey) {
    const conversationResult = await runQuery(
      `SELECT id, session_key, visitor_label, channel, intent_mode, lead_status, context, last_message_at, created_at, updated_at
       FROM joz_conversations
       WHERE session_key = $1`,
      [sessionKey]
    );
    for (const row of conversationResult.rows || []) {
      conversationIds.add(row.id);
    }
  }

  const callbackClauses = [];
  const callbackParams = [];

  if (callbackRequestId) {
    callbackParams.push(callbackRequestId);
    callbackClauses.push(`id = $${callbackParams.length}`);
  }

  if (normalizedEmail) {
    callbackParams.push(normalizedEmail);
    callbackClauses.push(`LOWER(COALESCE(requested_email, '')) = $${callbackParams.length}`);
  }

  if (normalizedPhone) {
    callbackParams.push(normalizedPhone);
    callbackClauses.push(
      `regexp_replace(COALESCE(requested_phone, ''), '\\D', '', 'g') = $${callbackParams.length}`
    );
  }

  if (callbackClauses.length) {
    const callbackResult = await runQuery(
      `SELECT id, conversation_id, profile_id, requested_name, requested_phone, requested_time,
              requested_email, source, payload, delivery_status, delivery_channels,
              delivery_errors, created_at
       FROM joz_callback_requests
       WHERE ${callbackClauses.join(" OR ")}`,
      callbackParams
    );

    for (const row of callbackResult.rows || []) {
      const emailMatches =
        !normalizedEmail ||
        normalizePrivacyEmail(row.requested_email) === normalizedEmail;
      const phoneMatches =
        !normalizedPhone ||
        normalizePrivacyPhone(row.requested_phone) === normalizedPhone;
      const callbackIdMatches =
        !callbackRequestId || String(row.id) === String(callbackRequestId);

      if (!emailMatches || !phoneMatches || !callbackIdMatches) continue;

      callbackById.set(String(row.id), row);
      if (row.conversation_id) {
        conversationIds.add(row.conversation_id);
      }
    }
  }

  let conversations = [];
  let messages = [];

  if (conversationIds.size) {
    const ids = [...conversationIds];
    const conversationResult = await runQuery(
      `SELECT id, session_key, visitor_label, channel, intent_mode, lead_status, context,
              last_message_at, created_at, updated_at
       FROM joz_conversations
       WHERE id = ANY($1::uuid[])
       ORDER BY created_at ASC`,
      [ids]
    );
    conversations = conversationResult.rows || [];

    const messageResult = await runQuery(
      `SELECT id, conversation_id, role, message_kind, content, tool_name, citations, metadata, created_at
       FROM joz_messages
       WHERE conversation_id = ANY($1::uuid[])
       ORDER BY created_at ASC`,
      [ids]
    );
    messages = messageResult.rows || [];
  }

  return {
    conversations,
    messages,
    callbackRequests: [...callbackById.values()].sort(
      (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    ),
  };
}

export async function exportJozPrivacyBundle(filters = {}) {
  const { conversations, messages, callbackRequests } = await resolvePrivacyTargets(filters);

  return {
    exportedAt: new Date().toISOString(),
    filters: {
      conversationId: filters.conversationId || null,
      sessionKey: filters.sessionKey || null,
      callbackRequestId: filters.callbackRequestId || null,
      email: filters.email || null,
      phone: filters.phone || null,
    },
    conversations,
    messages,
    callbackRequests,
  };
}

export async function deleteJozPrivacyBundle(filters = {}) {
  const { conversations, callbackRequests } = await resolvePrivacyTargets(filters);
  const conversationIds = [...new Set((conversations || []).map((row) => row.id).filter(Boolean))];
  const callbackRequestIds = [...new Set((callbackRequests || []).map((row) => row.id).filter(Boolean))];

  let deletedCallbackRequests = 0;
  let deletedConversations = 0;
  let deletedMessages = 0;

  if (callbackRequestIds.length) {
    const callbackDeleteResult = await runQuery(
      `DELETE FROM joz_callback_requests
       WHERE id = ANY($1::bigint[])
       RETURNING id`,
      [callbackRequestIds]
    );
    deletedCallbackRequests = callbackDeleteResult.rows?.length || 0;
  }

  if (conversationIds.length) {
    const messageCountResult = await runQuery(
      `SELECT COUNT(*)::int AS count
       FROM joz_messages
       WHERE conversation_id = ANY($1::uuid[])`,
      [conversationIds]
    );
    deletedMessages = messageCountResult.rows[0]?.count || 0;

    const conversationDeleteResult = await runQuery(
      `DELETE FROM joz_conversations
       WHERE id = ANY($1::uuid[])
       RETURNING id`,
      [conversationIds]
    );
    deletedConversations = conversationDeleteResult.rows?.length || 0;
  }

  return {
    deletedConversations,
    deletedMessages,
    deletedCallbackRequests,
  };
}

export async function cleanupExpiredJozData({
  conversationRetentionDays = 30,
  callbackRetentionDays = 30,
  privacyRequestRetentionDays = 365,
} = {}) {
  const db = getPool();
  if (!db) {
    return {
      deletedConversations: 0,
      deletedCallbackRequests: 0,
      deletedPrivacyRequests: 0,
    };
  }

  const normalizedConversationDays = Math.max(1, Number(conversationRetentionDays) || 30);
  const normalizedCallbackDays = Math.max(1, Number(callbackRetentionDays) || 30);
  const normalizedPrivacyDays = Math.max(1, Number(privacyRequestRetentionDays) || 365);

  const callbackDeleteResult = await runQuery(
    `DELETE FROM joz_callback_requests
     WHERE created_at < NOW() - ($1 * INTERVAL '1 day')
     RETURNING id`,
    [normalizedCallbackDays]
  );

  const conversationDeleteResult = await runQuery(
    `DELETE FROM joz_conversations
     WHERE COALESCE(last_message_at, updated_at, created_at) < NOW() - ($1 * INTERVAL '1 day')
     RETURNING id`,
    [normalizedConversationDays]
  );

  const privacyRequestDeleteResult = await runQuery(
    `DELETE FROM joz_privacy_requests
     WHERE created_at < NOW() - ($1 * INTERVAL '1 day')
     RETURNING id`,
    [normalizedPrivacyDays]
  );

  return {
    deletedConversations: conversationDeleteResult.rows?.length || 0,
    deletedCallbackRequests: callbackDeleteResult.rows?.length || 0,
    deletedPrivacyRequests: privacyRequestDeleteResult.rows?.length || 0,
  };
}

async function seedWorldModel(db) {
  for (const [portalKey, name, route, summary] of WORLD_MODEL_SEED.portals) {
    await db.query(
      `
        INSERT INTO world_portals (portal_key, name, route, summary)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (portal_key)
        DO UPDATE SET
          name = EXCLUDED.name,
          route = EXCLUDED.route,
          summary = EXCLUDED.summary,
          updated_at = NOW()
      `,
      [portalKey, name, route, summary],
    );
  }

  for (const [portalKey, stateKey, name, summary, isEntry] of WORLD_MODEL_SEED.states) {
    await db.query(
      `
        INSERT INTO world_states (portal_key, state_key, name, summary, is_entry)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (portal_key, state_key)
        DO UPDATE SET
          name = EXCLUDED.name,
          summary = EXCLUDED.summary,
          is_entry = EXCLUDED.is_entry,
          updated_at = NOW()
      `,
      [portalKey, stateKey, name, summary, isEntry],
    );
  }

  for (const [actionKey, label, kind, summary] of WORLD_MODEL_SEED.actions) {
    await db.query(
      `
        INSERT INTO world_actions (action_key, label, kind, summary)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (action_key)
        DO UPDATE SET
          label = EXCLUDED.label,
          kind = EXCLUDED.kind,
          summary = EXCLUDED.summary,
          updated_at = NOW()
      `,
      [actionKey, label, kind, summary],
    );
  }

  for (const [portalKey, objectKey, mesh_name, displayName, description, targetRoute, triggerAction] of WORLD_MODEL_SEED.objects) {
    await db.query(
      `
        INSERT INTO world_objects (
          portal_key, object_key, mesh_name, display_name, description, target_route, trigger_action
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (portal_key, object_key)
        DO UPDATE SET
          mesh_name = EXCLUDED.mesh_name,
          display_name = EXCLUDED.display_name,
          description = EXCLUDED.description,
          target_route = EXCLUDED.target_route,
          trigger_action = EXCLUDED.trigger_action,
          updated_at = NOW()
      `,
      [portalKey, objectKey, mesh_name, displayName, description, targetRoute, triggerAction],
    );
  }

  for (const [objectKey, alias] of WORLD_MODEL_SEED.aliases) {
    await db.query(
      `
        INSERT INTO world_object_aliases (object_key, alias)
        VALUES ($1, $2)
        ON CONFLICT (object_key, alias) DO NOTHING
      `,
      [objectKey, alias],
    );
  }

  for (const [stateKey, actionKey] of WORLD_MODEL_SEED.stateActions) {
    await db.query(
      `
        INSERT INTO world_state_actions (state_key, action_key)
        VALUES ($1, $2)
        ON CONFLICT (state_key, action_key) DO NOTHING
      `,
      [stateKey, actionKey],
    );
  }

  for (const [stateKey, actionKey, nextStateKey, targetRoute, awareness] of WORLD_MODEL_SEED.transitions) {
    await db.query(
      `
        INSERT INTO world_state_transitions (
          state_key, action_key, next_state_key, target_route, awareness
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (state_key, action_key)
        DO UPDATE SET
          next_state_key = EXCLUDED.next_state_key,
          target_route = EXCLUDED.target_route,
          awareness = EXCLUDED.awareness,
          updated_at = NOW()
      `,
      [stateKey, actionKey, nextStateKey, targetRoute, awareness],
    );
  }

  for (const [stateKey, actionKey, phrase] of WORLD_MODEL_SEED.phrases) {
    await db.query(
      `
        INSERT INTO world_transition_phrases (state_key, action_key, phrase)
        VALUES ($1, $2, $3)
        ON CONFLICT (state_key, action_key, phrase) DO NOTHING
      `,
      [stateKey, actionKey, phrase],
    );
  }
}

export async function initDatabase() {
  const db = getPool();
  if (!db) {
    console.log("🗄️ No database URL set, using file memory only");
    return;
  }

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS portal_transitions (
        portal_key TEXT NOT NULL,
        current_state TEXT NOT NULL,
        command_key TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT,
        awareness TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (portal_key, current_state, command_key)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS reasoning_events (
        id BIGSERIAL PRIMARY KEY,
        portal_key TEXT,
        current_state TEXT,
        transcript TEXT,
        normalized_transcript TEXT,
        command_key TEXT,
        resolved_action TEXT,
        resolved_target TEXT,
        source TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS world_portals (
        portal_key TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        route TEXT,
        summary TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS world_states (
        portal_key TEXT NOT NULL,
        state_key TEXT NOT NULL,
        name TEXT NOT NULL,
        summary TEXT,
        is_entry BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (portal_key, state_key)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS world_actions (
        action_key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        kind TEXT,
        summary TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS world_objects (
        portal_key TEXT NOT NULL,
        object_key TEXT NOT NULL,
        mesh_name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT,
        target_route TEXT,
        trigger_action TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (portal_key, object_key)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS world_object_aliases (
        object_key TEXT NOT NULL,
        alias TEXT NOT NULL,
        PRIMARY KEY (object_key, alias)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS world_state_actions (
        state_key TEXT NOT NULL,
        action_key TEXT NOT NULL,
        PRIMARY KEY (state_key, action_key)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS world_state_transitions (
        state_key TEXT NOT NULL,
        action_key TEXT NOT NULL,
        next_state_key TEXT,
        target_route TEXT,
        awareness TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (state_key, action_key)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS world_transition_phrases (
        state_key TEXT NOT NULL,
        action_key TEXT NOT NULL,
        phrase TEXT NOT NULL,
        PRIMARY KEY (state_key, action_key, phrase)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_profiles (
        id BIGSERIAL PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        label TEXT NOT NULL,
        headline TEXT,
        summary TEXT,
        website_url TEXT,
        email TEXT,
        phone TEXT,
        location TEXT,
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_documents (
        id BIGSERIAL PRIMARY KEY,
        profile_id BIGINT NOT NULL REFERENCES joz_profiles(id) ON DELETE CASCADE,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        source_type TEXT NOT NULL DEFAULT 'manual',
        source_uri TEXT,
        summary TEXT,
        body TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (profile_id, slug)
      )
    `);

    await db.query(`
      ALTER TABLE joz_documents
      ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
    `);

    await db.query(`
      ALTER TABLE joz_documents
      ADD COLUMN IF NOT EXISTS is_runtime_active BOOLEAN NOT NULL DEFAULT TRUE
    `);

    await db.query(`
      ALTER TABLE joz_documents
      ADD COLUMN IF NOT EXISTS publish_version TEXT
    `);

    await db.query(`
      ALTER TABLE joz_documents
      ADD COLUMN IF NOT EXISTS source_checksum TEXT
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_documents_category_idx
      ON joz_documents (profile_id, category)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_documents_runtime_idx
      ON joz_documents (profile_id, is_runtime_active, visibility, published_at DESC)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_documents_lane_idx
      ON joz_documents ((metadata->>'lane'))
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id BIGINT NOT NULL REFERENCES joz_profiles(id) ON DELETE CASCADE,
        session_key TEXT,
        visitor_label TEXT,
        channel TEXT NOT NULL DEFAULT 'web',
        intent_mode TEXT,
        lead_status TEXT NOT NULL DEFAULT 'anonymous',
        context JSONB NOT NULL DEFAULT '{}'::jsonb,
        last_message_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_conversations_profile_idx
      ON joz_conversations (profile_id, created_at DESC)
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES joz_conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
        message_kind TEXT NOT NULL DEFAULT 'chat',
        content TEXT NOT NULL,
        tool_name TEXT,
        citations JSONB NOT NULL DEFAULT '[]'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_messages_conversation_idx
      ON joz_messages (conversation_id, created_at ASC)
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_llm_request_events (
        id BIGSERIAL PRIMARY KEY,
        conversation_id UUID REFERENCES joz_conversations(id) ON DELETE SET NULL,
        session_key TEXT,
        route TEXT,
        intent_mode TEXT,
        user_message TEXT NOT NULL,
        assistant_reply TEXT NOT NULL,
        request_context JSONB NOT NULL DEFAULT '{}'::jsonb,
        trace JSONB NOT NULL DEFAULT '{}'::jsonb,
        verification JSONB NOT NULL DEFAULT '{}'::jsonb,
        retrieved_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
        retrieved_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
        latency_ms INTEGER,
        response_status TEXT NOT NULL DEFAULT 'ok',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_llm_request_events_created_idx
      ON joz_llm_request_events (created_at DESC)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_llm_request_events_route_idx
      ON joz_llm_request_events (route, created_at DESC)
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_publish_runs (
        id BIGSERIAL PRIMARY KEY,
        profile_id BIGINT REFERENCES joz_profiles(id) ON DELETE SET NULL,
        publish_version TEXT NOT NULL UNIQUE,
        source_type TEXT NOT NULL DEFAULT 'joz_knowledge',
        source_count INTEGER NOT NULL DEFAULT 0,
        normalized_count INTEGER NOT NULL DEFAULT 0,
        published_count INTEGER NOT NULL DEFAULT 0,
        verification_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
        source_bundle_path TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'published',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_publish_runs_profile_idx
      ON joz_publish_runs (profile_id, created_at DESC)
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_callback_requests (
        id BIGSERIAL PRIMARY KEY,
        conversation_id UUID,
        profile_id BIGINT,
        requested_name TEXT NOT NULL,
        requested_phone TEXT NOT NULL,
        requested_time TEXT NOT NULL,
        requested_email TEXT,
        source TEXT NOT NULL DEFAULT 'joz_llm',
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        delivery_status TEXT NOT NULL DEFAULT 'stored_only',
        delivery_channels JSONB NOT NULL DEFAULT '[]'::jsonb,
        delivery_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_privacy_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_type TEXT NOT NULL,
        request_status TEXT NOT NULL DEFAULT 'received',
        email TEXT,
        phone TEXT,
        conversation_id UUID REFERENCES joz_conversations(id) ON DELETE SET NULL,
        callback_request_id BIGINT REFERENCES joz_callback_requests(id) ON DELETE SET NULL,
        session_key TEXT,
        source TEXT NOT NULL DEFAULT 'web',
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      ALTER TABLE joz_callback_requests
      ALTER COLUMN conversation_id TYPE UUID
      USING CASE
        WHEN conversation_id IS NULL THEN NULL
        ELSE conversation_id::text::uuid
      END
    `).catch(() => {});

    for (const [portalKey, currentState, commandKey, action, target, awareness = null] of TRANSITION_SEED) {
      await db.query(
        `
          INSERT INTO portal_transitions (
            portal_key, current_state, command_key, action, target, awareness
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (portal_key, current_state, command_key)
          DO UPDATE SET
            action = EXCLUDED.action,
            target = EXCLUDED.target,
            awareness = EXCLUDED.awareness,
            updated_at = NOW()
        `,
        [portalKey, currentState, commandKey, action, target, awareness],
      );
    }

    await seedWorldModel(db);

    console.log("🗄️ Supabase/Postgres ready");
  } catch (error) {
    console.error("⚠️ Database init failed, falling back to file memory:", error.message);
    if (pool) {
      await pool.end().catch(() => {});
      pool = null;
    }
    delete process.env.SUPABASE_DB_URL;
    delete process.env.DATABASE_URL;
  }
}

export async function getPortalTransition(portalKey, currentState, commandKey) {
  const db = getPool();
  if (!db) return null;

  const { rows } = await db.query(
    `
      SELECT action, target, awareness
      FROM portal_transitions
      WHERE portal_key = $1
        AND current_state = $2
        AND command_key = $3
      LIMIT 1
    `,
    [portalKey, currentState, commandKey],
  );

  return rows[0] || null;
}

export async function getStructuredWorldState(portalKey, stateKey) {
  const db = getPool();
  if (!db || !portalKey || !stateKey) return null;

  const portalResult = await db.query(
    `
      SELECT portal_key, name, route, summary
      FROM world_portals
      WHERE portal_key = $1
      LIMIT 1
    `,
    [portalKey],
  );
  if (!portalResult.rows[0]) return null;

  const stateResult = await db.query(
    `
      SELECT portal_key, state_key, name, summary, is_entry
      FROM world_states
      WHERE portal_key = $1
        AND state_key = $2
      LIMIT 1
    `,
    [portalKey, stateKey],
  );
  if (!stateResult.rows[0]) return null;

  const actionsResult = await db.query(
    `
      SELECT a.action_key
      FROM world_state_actions s
      JOIN world_actions a ON a.action_key = s.action_key
      WHERE s.state_key = $1
      ORDER BY a.action_key
    `,
    [stateKey],
  );

  const objectsResult = await db.query(
    `
      SELECT
        o.object_key,
        o.mesh_name,
        o.display_name,
        o.description,
        o.target_route,
        o.trigger_action,
        COALESCE(array_agg(oa.alias ORDER BY oa.alias) FILTER (WHERE oa.alias IS NOT NULL), '{}') AS aliases
      FROM world_objects o
      LEFT JOIN world_object_aliases oa ON oa.object_key = o.object_key
      WHERE o.portal_key = $1
      GROUP BY o.portal_key, o.object_key, o.mesh_name, o.display_name, o.description, o.target_route, o.trigger_action
      ORDER BY o.object_key
    `,
    [portalKey],
  );

  const transitionsResult = await db.query(
    `
      SELECT
        t.state_key,
        t.action_key,
        t.next_state_key,
        t.target_route,
        t.awareness,
        COALESCE(array_agg(p.phrase ORDER BY p.phrase) FILTER (WHERE p.phrase IS NOT NULL), '{}') AS phrases
      FROM world_state_transitions t
      LEFT JOIN world_transition_phrases p
        ON p.state_key = t.state_key
       AND p.action_key = t.action_key
      WHERE t.state_key = $1
      GROUP BY t.state_key, t.action_key, t.next_state_key, t.target_route, t.awareness
      ORDER BY t.action_key
    `,
    [stateKey],
  );

  return {
    portal: portalResult.rows[0],
    state: stateResult.rows[0],
    availableActions: actionsResult.rows.map((row) => row.action_key),
    objects: objectsResult.rows.map((row) => ({
      objectKey: row.object_key,
      mesh: row.mesh_name,
      displayName: row.display_name,
      description: row.description,
      targetRoute: row.target_route,
      triggerAction: row.trigger_action,
      aliases: row.aliases || [],
    })),
    transitions: transitionsResult.rows.map((row) => ({
      stateKey: row.state_key,
      action: row.action_key,
      nextStateKey: row.next_state_key,
      target: row.target_route,
      awareness: row.awareness,
      phrases: row.phrases || [],
    })),
  };
}

export async function logReasoningEvent(event) {
  const db = getPool();
  if (!db) return;

  const {
    portalKey = null,
    currentState = null,
    transcript = null,
    normalizedTranscript = null,
    commandKey = null,
    resolvedAction = null,
    resolvedTarget = null,
    source = null,
  } = event;

  try {
    await db.query(
      `
        INSERT INTO reasoning_events (
          portal_key,
          current_state,
          transcript,
          normalized_transcript,
          command_key,
          resolved_action,
          resolved_target,
          source
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        portalKey,
        currentState,
        transcript,
        normalizedTranscript,
        commandKey,
        resolvedAction,
        resolvedTarget,
        source,
      ],
    );
  } catch (error) {
    console.error("⚠️ Failed to log reasoning event:", error.message);
  }
}
