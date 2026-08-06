import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getJozLaneConfig, normalizeJozLaneIntent } from "./shared/jozLlmLanes.js";
import { rankJozDocumentsForQuery } from "./shared/jozOntology.js";
import {
  isDocumentAllowedForTenant,
  JOZ_PUBLIC_DATASET_ID,
  JOZ_PUBLIC_TENANT_ID,
} from "./shared/jozDataGovernance.js";
import { buildPgvectorLiteral } from "./shared/jozHybridRetrieval.js";
import { normalizeWorldTrajectoryRecord } from "./shared/worldTrajectory.js";

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
  if (isDatabaseRequired()) return [];
  if (publishedJozDocsCache) return publishedJozDocsCache;
  const docsPaths = [
    resolvePublishedJozDocsPath(),
    path.join(path.dirname(resolvePublishedJozDocsPath()), "joz-world-model.generated.json"),
  ].filter((docsPath, index, paths) => paths.indexOf(docsPath) === index && fs.existsSync(docsPath));
  if (!docsPaths.length) {
    publishedJozDocsCache = [];
    return publishedJozDocsCache;
  }

  publishedJozDocsCache = docsPaths.flatMap((docsPath) => {
    const published = JSON.parse(fs.readFileSync(docsPath, "utf8"));
    if (Array.isArray(published?.model_ready_records)) return published.model_ready_records;
    const records = Array.isArray(published?.records) ? published.records : [];
    return records.filter((record) =>
      MODEL_READY_STATUSES.has(
        String(
          record?.metadata?.verification_status ||
            record?.metadata?.verification?.status ||
            ""
        ).trim().toLowerCase()
      )
    );
  });
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
      dataset_id: row?.metadata?.dataset_id || JOZ_PUBLIC_DATASET_ID,
      tenant_id: row?.metadata?.tenant_id || JOZ_PUBLIC_TENANT_ID,
      classification: row?.metadata?.classification || "public",
      evidence_tier: row?.metadata?.evidence_tier || "unverified",
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

export function isDatabaseRequired() {
  return String(process.env.JOZ_REQUIRE_DATABASE || "").trim().toLowerCase() === "true" ||
    String(process.env.RENDER || "").trim().toLowerCase() === "true" ||
    String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

function getPool() {
  if (!isDatabaseEnabled()) return null;
  if (pool) return pool;

  pool = new Pool({
    connectionString: getDatabaseUrl(),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
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
     ORDER BY (
       SELECT COUNT(*)
       FROM joz_documents d
       WHERE d.profile_id = joz_profiles.id
         AND d.is_runtime_active = TRUE
         AND d.visibility = 'public'
     ) DESC,
     updated_at DESC,
     id DESC
     LIMIT 1`
  );
  return result.rows[0] || null;
}

export async function getJozDataControlOverview() {
  if (!isDatabaseEnabled()) {
    return {
      reachable: false,
      required: isDatabaseRequired(),
      runtimeSource: "local_file_memory",
      reason: "database_not_configured",
      datasets: [],
      sources: [],
      counts: {},
    };
  }

  try {
    const [datasetResult, sourceResult, countResult] = await Promise.all([
      runQuery(`
        SELECT dataset_id, tenant_id, name, owner, classification, visibility,
               schema_version, source_count, normalized_count, published_count,
               model_ready_count, verified_count, content_checksum, status,
               published_at, updated_at
        FROM joz_datasets
        WHERE tenant_id = 'public' AND dataset_id = 'joz-public-knowledge'
        ORDER BY updated_at DESC
      `),
      runQuery(`
        SELECT dataset_id, tenant_id, source_id, source_key, source_filename,
               source_uri, source_types, owner, classification, visibility,
               record_count, model_ready_count, verified_count, evidence_tiers,
               source_checksum, status, last_published_at, updated_at
        FROM joz_data_sources
        WHERE tenant_id = 'public' AND dataset_id = 'joz-public-knowledge'
        ORDER BY source_key ASC
      `),
      runQuery(`
        SELECT
          (SELECT COUNT(*) FROM joz_documents WHERE visibility = 'public')::int AS documents,
          (SELECT COUNT(*) FROM joz_documents WHERE visibility = 'public' AND is_runtime_active = TRUE)::int AS active_documents,
          (SELECT COUNT(*) FROM joz_conversations)::int AS conversations,
          (SELECT COUNT(*) FROM joz_messages)::int AS messages,
          (SELECT COUNT(*) FROM joz_llm_request_events)::int AS request_events,
          (SELECT COUNT(*) FROM joz_llm_evaluations)::int AS evaluations,
          (SELECT COUNT(*) FROM joz_action_proposals)::int AS action_proposals,
          (SELECT COUNT(*) FROM joz_action_events)::int AS action_events
      `),
    ]);

    return {
      reachable: true,
      required: isDatabaseRequired(),
      runtimeSource: "supabase_postgres",
      datasets: datasetResult.rows || [],
      sources: sourceResult.rows || [],
      counts: countResult.rows[0] || {},
    };
  } catch (error) {
    return {
      reachable: false,
      required: isDatabaseRequired(),
      runtimeSource: "supabase_postgres",
      reason: error?.message || "data control tables are not available",
      code: error?.code || null,
      datasets: [],
      sources: [],
      counts: {},
    };
  }
}

export async function getJozDocumentsByIntent(
  intentMode = "skills",
  limit = 8,
  query = "",
  { tenantId = JOZ_PUBLIC_TENANT_ID, datasetId = JOZ_PUBLIC_DATASET_ID } = {}
) {
  const primaryCategory = normalizeJozLaneIntent(intentMode);
  const lane = getJozLaneConfig(primaryCategory);
  const isControlLane = ["booking", "interaction"].includes(primaryCategory);
  const categories = isControlLane
    ? [primaryCategory]
    : [
        ...new Set([
          ...(lane?.retrievalCategories || [primaryCategory, "case_study", "proof", "bio", "faq"]),
          "skills",
          "systems_mindset",
          "business_need",
          "systems_principle",
          "governance",
          "governance_principle",
          "world_model",
        ]),
      ];
  const laneAliases = isControlLane
    ? [primaryCategory]
    : [
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
         ORDER BY (
           SELECT COUNT(*)
           FROM joz_documents d
           WHERE d.profile_id = joz_profiles.id
             AND d.is_runtime_active = TRUE
             AND d.visibility = 'public'
         ) DESC,
         updated_at DESC,
         id DESC
         LIMIT 1
       )
       AND is_runtime_active = TRUE
       AND visibility = 'public'
       AND COALESCE(metadata->>'tenant_id', 'public') = $5
       AND COALESCE(metadata->>'visibility', 'public') = 'public'
       AND ($6::text IS NULL OR COALESCE(metadata->>'dataset_id', 'joz-public-knowledge') = $6)
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
    [
      categories,
      laneAliases,
      primaryCategory,
      Math.max(limit * 5, 20),
      String(tenantId || JOZ_PUBLIC_TENANT_ID),
      datasetId ? String(datasetId) : null,
    ]
  );
  const dbDocuments = (result.rows || []).map(normalizeJozDocumentRow);
  const merged = new Map();

  for (const doc of loadPublishedJozDocuments()) {
    const docLane = String(doc?.metadata?.lane || "").trim();
    const docCategory = String(doc?.category || "").trim();
    if (!laneAliases.includes(docLane) && !categories.includes(docCategory)) continue;
    if (!isDocumentAllowedForTenant(doc, { tenantId, datasetId })) continue;

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
        visibility: doc?.metadata?.visibility || "public",
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

export async function getJozSemanticDocumentsByQuery(
  intentMode = "skills",
  embedding = [],
  limit = 8,
  { tenantId = JOZ_PUBLIC_TENANT_ID, datasetId = JOZ_PUBLIC_DATASET_ID } = {}
) {
  if (!isDatabaseEnabled() || !Array.isArray(embedding) || embedding.length === 0) return [];

  const primaryCategory = normalizeJozLaneIntent(intentMode);
  const lane = getJozLaneConfig(primaryCategory);
  const isControlLane = ["booking", "interaction"].includes(primaryCategory);
  const categories = isControlLane
    ? [primaryCategory]
    : [
        ...new Set([
          ...(lane?.retrievalCategories || [primaryCategory, "case_study", "proof", "bio", "faq"]),
          "skills",
          "systems_mindset",
          "business_need",
          "systems_principle",
          "governance",
          "governance_principle",
          "world_model",
        ]),
      ];
  const laneAliases = isControlLane
    ? [primaryCategory]
    : [
        primaryCategory,
        primaryCategory === "systems_mindset" ? "mindset" : null,
        "skills",
        "systems_mindset",
        "business_need",
      ].filter(Boolean);
  const vector = buildPgvectorLiteral(embedding);
  const result = await runQuery(
    `WITH ranked_chunks AS (
       SELECT
         d.id, d.slug, d.title, d.category, d.summary, d.body, d.metadata,
         d.visibility, d.publish_version, d.updated_at,
         c.embedding_model,
         (1 - (c.embedding <=> $1::vector))::float8 AS semantic_similarity,
         ROW_NUMBER() OVER (
           PARTITION BY d.id
           ORDER BY c.embedding <=> $1::vector, c.id ASC
         ) AS chunk_rank
       FROM joz_document_chunks c
       JOIN joz_documents d ON d.id = c.document_id
       WHERE d.profile_id = (
           SELECT id FROM joz_profiles
           WHERE is_primary = TRUE
         ORDER BY (
           SELECT COUNT(*)
           FROM joz_documents d
           WHERE d.profile_id = joz_profiles.id
             AND d.is_runtime_active = TRUE
             AND d.visibility = 'public'
         ) DESC,
         updated_at DESC,
         id DESC
           LIMIT 1
         )
         AND d.is_runtime_active = TRUE
         AND d.visibility = 'public'
         AND c.embedding IS NOT NULL
         AND COALESCE(d.metadata->>'tenant_id', 'public') = $2
         AND COALESCE(d.metadata->>'visibility', 'public') = 'public'
         AND ($3::text IS NULL OR COALESCE(d.metadata->>'dataset_id', 'joz-public-knowledge') = $3)
         AND (
           d.category = ANY($4::text[])
           OR COALESCE(d.metadata->>'lane', '') = ANY($5::text[])
         )
     )
     SELECT id, slug, title, category, summary, body, metadata,
            visibility, publish_version, updated_at, embedding_model,
            semantic_similarity
     FROM ranked_chunks
     WHERE chunk_rank = 1
     ORDER BY semantic_similarity DESC, id ASC
     LIMIT $6`,
    [
      vector,
      String(tenantId || JOZ_PUBLIC_TENANT_ID),
      datasetId ? String(datasetId) : null,
      categories,
      laneAliases,
      Math.max(limit * 3, 20),
    ]
  );

  return (result.rows || []).map((row) => {
    const normalized = normalizeJozDocumentRow(row);
    return {
    ...normalized,
    metadata: {
      ...normalized.metadata,
      updated_at: row.updated_at || null,
    },
    retrieval: {
      method: "pgvector",
      semanticSimilarity: Number(row.semantic_similarity) || 0,
      embeddingModel: row.embedding_model || null,
    },
    };
  });
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

export async function upsertConsultantAssessment({
  assessmentId,
  sessionKey = null,
  status = "discovery_in_progress",
  profile = {},
  analysis = null,
  version = "world-model-consultant-mvp-1",
} = {}) {
  if (!isDatabaseEnabled() || !assessmentId) return null;
  try {
    const result = await runQuery(
      `INSERT INTO joz_consultant_assessments
         (id, session_key, status, profile, analysis, version)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
       ON CONFLICT (id) DO UPDATE SET
         session_key = COALESCE(EXCLUDED.session_key, joz_consultant_assessments.session_key),
         status = EXCLUDED.status,
         profile = EXCLUDED.profile,
         analysis = EXCLUDED.analysis,
         version = EXCLUDED.version,
         updated_at = NOW()
       RETURNING id, session_key, status, profile, analysis, version, created_at, updated_at`,
      [assessmentId, sessionKey, status, JSON.stringify(profile || {}), JSON.stringify(analysis || null), version]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("⚠️ Failed to persist consultant assessment:", error.message);
    return null;
  }
}

export async function getConsultantAssessment(assessmentId) {
  if (!isDatabaseEnabled() || !assessmentId) return null;
  try {
    const [assessmentResult, messageResult] = await Promise.all([
      runQuery(
        `SELECT id, session_key, status, profile, analysis, version, created_at, updated_at
         FROM joz_consultant_assessments WHERE id = $1`,
        [assessmentId]
      ),
      runQuery(
        `SELECT id, role, field, content, created_at
         FROM joz_consultant_assessment_messages
         WHERE assessment_id = $1 ORDER BY created_at ASC`,
        [assessmentId]
      ),
    ]);
    const assessment = assessmentResult.rows[0];
    return assessment ? { ...assessment, messages: messageResult.rows || [] } : null;
  } catch (error) {
    console.error("⚠️ Failed to load consultant assessment:", error.message);
    return null;
  }
}

export async function appendConsultantAssessmentMessage({ assessmentId, role, field = null, content = "" } = {}) {
  if (!isDatabaseEnabled() || !assessmentId || !role || !content) return null;
  try {
    const result = await runQuery(
      `INSERT INTO joz_consultant_assessment_messages (assessment_id, role, field, content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, role, field, content, created_at`,
      [assessmentId, role, field, content]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("⚠️ Failed to persist consultant assessment message:", error.message);
    return null;
  }
}

export async function createConsultantLead({
  assessmentId,
  name,
  email,
  company = "",
  role = "",
  engagement = "World Model Discovery Workshop",
  message = "",
} = {}) {
  if (!isDatabaseEnabled()) return null;
  try {
    const result = await runQuery(
      `INSERT INTO joz_consultant_leads
         (assessment_id, name, email, company, role, engagement, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, assessment_id, name, email, company, role, engagement, message, created_at`,
      [assessmentId, name, email, company, role, engagement, message]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("⚠️ Failed to persist consultant lead:", error.message);
    return null;
  }
}

export async function upsertBusinessValueCase({
  caseId = null,
  conversationId = null,
  sessionKey = null,
  companyKey = null,
  state = {},
} = {}) {
  if (!isDatabaseEnabled()) return null;

  const normalizedStatus =
    state?.status === "verified"
      ? "verified"
      : state?.status === "in_progress"
        ? "in_progress"
        : "open";

  try {
    if (caseId) {
      const result = await runQuery(
        `UPDATE joz_business_value_cases
         SET conversation_id = COALESCE($2, conversation_id),
             session_key = COALESCE($3, session_key),
             company_key = COALESCE($4, company_key),
             status = $5,
             active_node = $6,
             diagnosis = $7::jsonb,
             evidence = $8::jsonb,
             missing_evidence = $9::jsonb,
             confidence = $10,
             approval = $11::jsonb,
             solution_map = $12::jsonb,
             current_state = $13::jsonb,
             updated_at = NOW(),
             closed_at = CASE WHEN $5 = 'verified' THEN COALESCE(closed_at, NOW()) ELSE NULL END
         WHERE id = $1
         RETURNING *`,
        [
          caseId,
          conversationId,
          sessionKey,
          companyKey,
          normalizedStatus,
          state.activeNode || "data",
          JSON.stringify(state.diagnosis || {}),
          JSON.stringify(state.evidence || []),
          JSON.stringify(state.missingEvidence || []),
          Number(state.confidence) || 0,
          JSON.stringify(state.approval || {}),
          JSON.stringify(state.solutionMap || {}),
          JSON.stringify(state),
        ]
      );
      return result.rows[0] || null;
    }

    const existing = sessionKey
      ? await runQuery(
          `SELECT id
           FROM joz_business_value_cases
           WHERE session_key = $1 AND status <> 'closed'
           ORDER BY updated_at DESC
           LIMIT 1`,
          [sessionKey]
        )
      : { rows: [] };
    const existingId = existing.rows[0]?.id || null;
    if (existingId) {
      return upsertBusinessValueCase({
        caseId: existingId,
        conversationId,
        sessionKey,
        companyKey,
        state,
      });
    }

    const result = await runQuery(
      `INSERT INTO joz_business_value_cases (
         conversation_id, session_key, company_key, status, active_node,
         diagnosis, evidence, missing_evidence, confidence, approval,
         solution_map, current_state
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9,
               $10::jsonb, $11::jsonb, $12::jsonb)
       RETURNING *`,
      [
        conversationId,
        sessionKey,
        companyKey,
        normalizedStatus,
        state.activeNode || "data",
        JSON.stringify(state.diagnosis || {}),
        JSON.stringify(state.evidence || []),
        JSON.stringify(state.missingEvidence || []),
        Number(state.confidence) || 0,
        JSON.stringify(state.approval || {}),
        JSON.stringify(state.solutionMap || {}),
        JSON.stringify(state),
      ]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("⚠️ Failed to persist Business Value case:", error.message);
    return null;
  }
}

export async function appendBusinessValueCaseEvent({
  caseId,
  eventType,
  actor = "joz_llm",
  payload = {},
  sourceMessageId = null,
} = {}) {
  if (!isDatabaseEnabled() || !caseId || !eventType) return null;
  try {
    const result = await runQuery(
      `INSERT INTO joz_business_value_case_events
       (case_id, event_type, actor, payload, source_message_id)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING id, case_id, event_type, actor, payload, created_at`,
      [caseId, eventType, actor, JSON.stringify(payload || {}), sourceMessageId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("⚠️ Failed to persist Business Value case event:", error.message);
    return null;
  }
}

export async function getBusinessValueCase(caseId) {
  if (!isDatabaseEnabled() || !caseId) return null;
  try {
    const [caseResult, eventResult, evidenceResult] = await Promise.all([
      runQuery(`SELECT * FROM joz_business_value_cases WHERE id = $1`, [caseId]),
      runQuery(
        `SELECT id, case_id, event_type, actor, payload, source_message_id, created_at
         FROM joz_business_value_case_events
         WHERE case_id = $1
         ORDER BY created_at ASC`,
        [caseId]
      ),
      runQuery(
        `SELECT id, case_id, evidence_key, node, value, source_type, source_ref,
                verification_status, collected_at, verified_at
         FROM joz_business_value_evidence
         WHERE case_id = $1
         ORDER BY collected_at ASC`,
        [caseId]
      ),
    ]);
    if (!caseResult.rows[0]) return null;
    return {
      ...caseResult.rows[0],
      events: eventResult.rows || [],
      evidence_records: evidenceResult.rows || [],
    };
  } catch (error) {
    console.error("⚠️ Failed to load Business Value case:", error.message);
    return null;
  }
}

export async function upsertBusinessValueEvidence({ caseId, records = [] } = {}) {
  if (!isDatabaseEnabled() || !caseId || !Array.isArray(records) || !records.length) return [];
  const saved = [];
  for (const record of records) {
    try {
      const result = await runQuery(
        `INSERT INTO joz_business_value_evidence
           (case_id, evidence_key, node, value, source_type, source_ref, verification_status, collected_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, COALESCE($8::timestamptz, NOW()))
         ON CONFLICT (case_id, evidence_key) DO UPDATE SET
           value = EXCLUDED.value,
           source_type = EXCLUDED.source_type,
           source_ref = EXCLUDED.source_ref,
           verification_status = CASE
             WHEN joz_business_value_evidence.verification_status IN ('verified', 'corroborated')
               THEN joz_business_value_evidence.verification_status
             ELSE EXCLUDED.verification_status
           END
         RETURNING id, case_id, evidence_key, node, value, source_type, source_ref,
                   verification_status, collected_at, verified_at`,
        [
          caseId,
          record.evidenceKey,
          record.node,
          JSON.stringify(record.value || {}),
          record.sourceType || "company_document",
          record.sourceRef || null,
          record.verificationStatus || "unverified",
          record.collectedAt || null,
        ]
      );
      if (result.rows[0]) saved.push(result.rows[0]);
    } catch (error) {
      console.error("⚠️ Failed to persist Business Value evidence:", error.message);
    }
  }
  return saved;
}

export async function reviewBusinessValueEvidence({
  caseId,
  evidenceKey,
  verificationStatus = "verified",
  actor = "company_reviewer",
} = {}) {
  if (!isDatabaseEnabled() || !caseId || !evidenceKey) return null;
  const allowed = new Set(["claimed", "corroborated", "verified", "rejected"]);
  if (!allowed.has(verificationStatus)) throw new Error("Unsupported evidence review status");
  const result = await runQuery(
    `UPDATE joz_business_value_evidence
     SET verification_status = $3,
         verified_at = CASE WHEN $3 = 'verified' THEN NOW() ELSE NULL END
     WHERE case_id = $1 AND evidence_key = $2
     RETURNING id, case_id, evidence_key, node, value, source_type, source_ref,
               verification_status, collected_at, verified_at`,
    [caseId, evidenceKey, verificationStatus]
  );
  return result.rows[0] ? { ...result.rows[0], reviewedBy: actor } : null;
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

export async function createJozCausalToolRun({
  runId,
  requestId = null,
  conversationId = null,
  sessionKey = null,
  tenantId = "public",
  principalId = null,
  toolName = null,
  args = {},
  mode = "disabled",
  authorization = {},
} = {}) {
  if (!isDatabaseEnabled() || !runId || !toolName) return null;
  try {
    const result = await runQuery(
      `INSERT INTO joz_causal_tool_runs (
         run_id, request_id, conversation_id, session_key, tenant_id,
         principal_id, tool_name, arguments, mode, status, authorization
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, 'authorized', $10::jsonb)
       RETURNING run_id, request_id, conversation_id, session_key, tenant_id,
         principal_id, tool_name, arguments, mode, status, authorization,
         result, error_code, started_at, completed_at`,
      [
        runId,
        requestId,
        conversationId,
        sessionKey,
        tenantId,
        principalId,
        toolName,
        JSON.stringify(args || {}),
        mode,
        JSON.stringify(authorization || {}),
      ]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("⚠️ Failed to persist causal tool run:", error.message);
    return null;
  }
}

export async function completeJozCausalToolRun({
  runId,
  status = "completed",
  result = null,
  errorCode = null,
} = {}) {
  if (!isDatabaseEnabled() || !runId) return null;
  try {
    const queryResult = await runQuery(
      `UPDATE joz_causal_tool_runs
       SET status = $2,
           result = $3::jsonb,
           error_code = $4,
           completed_at = NOW()
       WHERE run_id = $1
       RETURNING run_id, status, result, error_code, started_at, completed_at`,
      [runId, status, JSON.stringify(result || null), errorCode]
    );
    return queryResult.rows[0] || null;
  } catch (error) {
    console.error("⚠️ Failed to complete causal tool run:", error.message);
    return null;
  }
}

export async function publishJozCausalDataset({
  dataset = {},
  status = "published",
} = {}) {
  if (!isDatabaseEnabled() || !dataset?.dataset_id || !dataset?.model_version) return null;
  const db = getPool();
  if (!db) return null;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO joz_causal_datasets
         (dataset_id, tenant_id, owner, classification, visibility, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (dataset_id) DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         owner = EXCLUDED.owner,
         classification = EXCLUDED.classification,
         visibility = EXCLUDED.visibility,
         status = EXCLUDED.status,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()`,
      [
        dataset.dataset_id,
        dataset.tenant_id || "public",
        dataset.metadata?.owner || "joz",
        dataset.metadata?.classification || "public",
        dataset.metadata?.visibility || "public",
        status,
        JSON.stringify(dataset.metadata || {}),
      ]
    );
    await client.query(
      `INSERT INTO joz_causal_dataset_versions
         (dataset_id, model_version, schema_version, graph, factual, checksum, row_count, status, metadata, published_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9::jsonb, CASE WHEN $8 = 'published' THEN NOW() ELSE NULL END)
       ON CONFLICT (dataset_id, model_version) DO UPDATE SET
         schema_version = EXCLUDED.schema_version,
         graph = EXCLUDED.graph,
         factual = EXCLUDED.factual,
         checksum = EXCLUDED.checksum,
         row_count = EXCLUDED.row_count,
         status = EXCLUDED.status,
         metadata = EXCLUDED.metadata,
         published_at = CASE WHEN EXCLUDED.status = 'published' THEN NOW() ELSE joz_causal_dataset_versions.published_at END,
         updated_at = NOW()`,
      [
        dataset.dataset_id,
        dataset.model_version,
        dataset.schema_version || "joz.causal-dataset.v1",
        JSON.stringify({ nodes: dataset.nodes || [], edges: dataset.edges || [] }),
        JSON.stringify(dataset.factual || null),
        dataset.checksum || null,
        Array.isArray(dataset.data) ? dataset.data.length : 0,
        status,
        JSON.stringify(dataset.metadata || {}),
      ]
    );
    await client.query(
      `DELETE FROM joz_causal_dataset_variables WHERE dataset_id = $1 AND model_version = $2`,
      [dataset.dataset_id, dataset.model_version]
    );
    for (const node of dataset.nodes || []) {
      await client.query(
        `INSERT INTO joz_causal_dataset_variables
           (dataset_id, model_version, variable_id, label, data_type, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          dataset.dataset_id,
          dataset.model_version,
          node.id,
          node.label || node.id,
          node.data_type || "numeric",
          JSON.stringify(node),
        ]
      );
    }
    await client.query(
      `DELETE FROM joz_causal_dataset_observations WHERE dataset_id = $1 AND model_version = $2`,
      [dataset.dataset_id, dataset.model_version]
    );
    for (const [rowIndex, values] of (dataset.data || []).entries()) {
      await client.query(
        `INSERT INTO joz_causal_dataset_observations
           (dataset_id, model_version, row_index, row_values)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [dataset.dataset_id, dataset.model_version, rowIndex, JSON.stringify(values)]
      );
    }
    await client.query("COMMIT");
    return {
      datasetId: dataset.dataset_id,
      modelVersion: dataset.model_version,
      status,
      rowCount: Array.isArray(dataset.data) ? dataset.data.length : 0,
      checksum: dataset.checksum || null,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("⚠️ Failed to publish causal dataset:", error.message);
    throw error;
  } finally {
    client.release();
  }
}

export async function getPublishedJozCausalDataset({
  datasetId,
  modelVersion,
  tenantId = "public",
} = {}) {
  if (!isDatabaseEnabled() || !datasetId || !modelVersion) return null;
  try {
    const versionResult = await runQuery(
      `SELECT v.dataset_id, v.model_version, v.schema_version, v.graph,
              v.factual, v.checksum, v.row_count, v.metadata,
              d.tenant_id, d.owner, d.classification, d.visibility, d.status
       FROM joz_causal_dataset_versions v
       JOIN joz_causal_datasets d ON d.dataset_id = v.dataset_id
       WHERE v.dataset_id = $1
         AND ($2 = 'latest_published' OR v.model_version = $2)
         AND v.status = 'published'
         AND d.status = 'published'
         AND d.tenant_id = $3
       ORDER BY v.published_at DESC NULLS LAST, v.created_at DESC
       LIMIT 1`,
      [datasetId, modelVersion, tenantId]
    );
    const version = versionResult.rows?.[0];
    if (!version) return null;
    const observations = await runQuery(
      `SELECT row_values FROM joz_causal_dataset_observations
       WHERE dataset_id = $1 AND model_version = $2
       ORDER BY row_index ASC`,
      [datasetId, modelVersion]
    );
    const graph = version.graph || {};
    return {
      schema_version: version.schema_version,
      metadata: {
        ...(version.metadata || {}),
        dataset_id: version.dataset_id,
        model_version: version.model_version,
        tenant_id: version.tenant_id,
        owner: version.owner,
        classification: version.classification,
        visibility: version.visibility,
      },
      dataset_id: version.dataset_id,
      model_version: version.model_version,
      tenant_id: version.tenant_id,
      nodes: graph.nodes || [],
      edges: graph.edges || [],
      data: (observations.rows || []).map((row) => row.row_values),
      ...(version.factual ? { factual: version.factual } : {}),
      checksum: version.checksum || null,
    };
  } catch (error) {
    console.error("⚠️ Failed to load published causal dataset:", error.message);
    return null;
  }
}

export async function listPublishedJozCausalDatasets({ tenantId = "public" } = {}) {
  if (!isDatabaseEnabled()) return [];
  try {
    const result = await runQuery(
      `SELECT d.dataset_id, d.tenant_id, d.owner, d.classification, d.visibility,
              v.model_version, v.schema_version, v.checksum, v.row_count,
              v.graph, v.metadata, v.published_at
       FROM joz_causal_datasets d
       JOIN joz_causal_dataset_versions v ON v.dataset_id = d.dataset_id
       WHERE d.tenant_id = $1
         AND d.status = 'published'
         AND v.status = 'published'
       ORDER BY v.published_at DESC NULLS LAST, d.dataset_id ASC`,
      [tenantId]
    );
    return (result.rows || []).map((row) => ({
      datasetId: row.dataset_id,
      tenantId: row.tenant_id,
      owner: row.owner,
      classification: row.classification,
      visibility: row.visibility,
      modelVersion: row.model_version,
      schemaVersion: row.schema_version,
      checksum: row.checksum,
      rowCount: row.row_count,
      variableCount: Array.isArray(row.graph?.nodes) ? row.graph.nodes.length : 0,
      edgeCount: Array.isArray(row.graph?.edges) ? row.graph.edges.length : 0,
      metadata: row.metadata || {},
      publishedAt: row.published_at,
    }));
  } catch (error) {
    console.error("⚠️ Failed to list published causal datasets:", error.message);
    return [];
  }
}

export async function saveJozActionProposal({
  proposal = {},
  sessionKey = null,
  status = "pending",
  approvalTokenHash = "",
  executionTokenHash = null,
  approvedBy = null,
  result = null,
  verification = {},
  createdAt = null,
  expiresAt = null,
  approvedAt = null,
  completedAt = null,
  eventType = "proposed",
  actor = "system",
  eventMetadata = {},
} = {}) {
  if (!isDatabaseEnabled() || !proposal?.proposalId || !approvalTokenHash || !expiresAt) return null;

  const resultRow = await runQuery(
    `INSERT INTO joz_action_proposals (
       proposal_id, session_key, action, risk, proposal, status,
       approval_token_hash, execution_token_hash, approved_by, result,
       verification, created_at, expires_at, approved_at, completed_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb,
             $11::jsonb, $12, $13, $14, $15, NOW())
     ON CONFLICT (proposal_id) DO UPDATE SET
       session_key = EXCLUDED.session_key,
       action = EXCLUDED.action,
       risk = EXCLUDED.risk,
       proposal = EXCLUDED.proposal,
       status = EXCLUDED.status,
       approval_token_hash = EXCLUDED.approval_token_hash,
       execution_token_hash = EXCLUDED.execution_token_hash,
       approved_by = EXCLUDED.approved_by,
       result = EXCLUDED.result,
       verification = EXCLUDED.verification,
       expires_at = EXCLUDED.expires_at,
       approved_at = EXCLUDED.approved_at,
       completed_at = EXCLUDED.completed_at,
       updated_at = NOW()
     RETURNING proposal_id`,
    [
      String(proposal.proposalId),
      sessionKey,
      String(proposal.action || "requested_action"),
      String(proposal.risk || "unknown"),
      JSON.stringify(proposal || {}),
      String(status || "pending"),
      String(approvalTokenHash),
      executionTokenHash,
      approvedBy,
      result === null ? null : JSON.stringify(result),
      JSON.stringify(verification || {}),
      createdAt || new Date().toISOString(),
      expiresAt,
      approvedAt,
      completedAt,
    ]
  );

  if (eventType) {
    await recordJozActionEvent({
      proposalId: proposal.proposalId,
      eventType,
      actor,
      metadata: eventMetadata,
    });
  }

  return resultRow.rows[0]?.proposal_id || null;
}

export async function loadJozActionProposal(proposalId) {
  if (!isDatabaseEnabled() || !proposalId) return null;
  const result = await runQuery(
    `SELECT proposal_id, session_key, proposal, status, approval_token_hash,
            execution_token_hash, approved_by, result, verification,
            created_at, expires_at, approved_at, completed_at
     FROM joz_action_proposals
     WHERE proposal_id = $1
     LIMIT 1`,
    [String(proposalId)]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    proposal: { ...(row.proposal || {}), proposalId: row.proposal_id, expiresAt: row.expires_at },
    sessionKey: row.session_key,
    status: row.status,
    tokenHash: row.approval_token_hash,
    executionTokenHash: row.execution_token_hash,
    approvedBy: row.approved_by,
    result: row.result,
    verification: row.verification || {},
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    approvedAt: row.approved_at,
    completedAt: row.completed_at,
  };
}

export async function updateJozActionProposal({
  proposalId,
  status,
  expectedStatus = null,
  expectedApprovalTokenHash = null,
  expectedExecutionTokenHash = null,
  executionTokenHash,
  approvedBy,
  result,
  verification,
  approvedAt,
  completedAt,
  eventType = null,
  actor = "system",
  eventMetadata = {},
} = {}) {
  if (!isDatabaseEnabled() || !proposalId) return null;
  const resultRow = await runQuery(
    `UPDATE joz_action_proposals
     SET status = COALESCE($2, status),
         execution_token_hash = CASE WHEN $3::boolean THEN $4 ELSE execution_token_hash END,
         approved_by = COALESCE($5, approved_by),
         result = CASE WHEN $6::boolean THEN $7::jsonb ELSE result END,
         verification = CASE WHEN $8::boolean THEN $9::jsonb ELSE verification END,
         approved_at = COALESCE($10, approved_at),
         completed_at = COALESCE($11, completed_at),
         updated_at = NOW()
     WHERE proposal_id = $1
       AND ($12::text IS NULL OR status = $12)
       AND ($13::text IS NULL OR approval_token_hash = $13)
       AND ($14::text IS NULL OR execution_token_hash = $14)
     RETURNING proposal_id`,
    [
      String(proposalId),
      status || null,
      executionTokenHash !== undefined,
      executionTokenHash === undefined ? null : executionTokenHash,
      approvedBy || null,
      result !== undefined,
      result === undefined || result === null ? null : JSON.stringify(result),
      verification !== undefined,
      verification === undefined ? null : JSON.stringify(verification || {}),
      approvedAt || null,
      completedAt || null,
      expectedStatus,
      expectedApprovalTokenHash,
      expectedExecutionTokenHash,
    ]
  );
  if (eventType) {
    await recordJozActionEvent({ proposalId, eventType, actor, metadata: eventMetadata });
  }
  return resultRow.rows[0]?.proposal_id || null;
}

export async function recordJozActionEvent({
  proposalId,
  eventType,
  actor = "system",
  metadata = {},
} = {}) {
  if (!isDatabaseEnabled() || !proposalId || !eventType) return null;
  const result = await runQuery(
    `INSERT INTO joz_action_events (proposal_id, event_type, actor, metadata)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id`,
    [String(proposalId), String(eventType), String(actor || "system").slice(0, 200), JSON.stringify(metadata || {})]
  );
  return result.rows[0]?.id || null;
}

export async function listRecentJozLlmRequestEvents(limit = 20) {
  const result = await runQuery(
    `SELECT id, conversation_id, session_key, route, intent_mode, user_message, assistant_reply,
            request_context, trace, verification, retrieved_categories, retrieved_documents,
            latency_ms, response_status, review_status, issue_type, review_notes,
            approved_correction, reviewed_by, reviewed_at, created_at
     FROM joz_llm_request_events
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.max(1, Math.min(500, Number(limit) || 20))]
  );
  return result.rows || [];
}

export async function listUnevaluatedJozLlmRequestEvents(limit = 20, sessionKeyPrefix = null) {
  const normalizedPrefix = String(sessionKeyPrefix || "").trim();
  const whereSession = normalizedPrefix ? " AND e.session_key LIKE $2" : "";
  const params = [Math.max(1, Math.min(500, Number(limit) || 20))];
  if (normalizedPrefix) params.push(`${normalizedPrefix}%`);
  const result = await runQuery(
    `SELECT e.id, e.conversation_id, e.session_key, e.route, e.intent_mode, e.user_message,
            e.assistant_reply, e.request_context, e.trace, e.verification,
            e.retrieved_categories, e.retrieved_documents, e.latency_ms,
            e.response_status, e.created_at
     FROM joz_llm_request_events e
     LEFT JOIN joz_llm_evaluations v ON v.request_event_id = e.id
     WHERE v.id IS NULL${whereSession}
     ORDER BY e.created_at DESC
     LIMIT $1`,
    params
  );
  return result.rows || [];
}

export async function saveJozLlmEvaluation({
  requestEventId,
  evaluatorModel = null,
  verdict = "warn",
  preAnswerVerdict = null,
  preAnswerCorrectness = null,
  preAnswerRelevance = null,
  preAnswerGroundedness = null,
  preAnswerSafety = null,
  finalVerdict = null,
  correctionEffective = null,
  correctionCritique = "",
  correctness = null,
  relevance = null,
  groundedness = null,
  safety = null,
  critique = "",
  repairNeeded = false,
  repairType = "none",
  repairSuggestion = "",
  rawEvaluation = {},
} = {}) {
  const result = await runQuery(
    `INSERT INTO joz_llm_evaluations (
       request_event_id, evaluator_model, verdict, pre_answer_verdict,
       pre_answer_correctness, pre_answer_relevance, pre_answer_groundedness,
       pre_answer_safety, final_verdict, correction_effective, correction_critique,
       correctness, relevance,
       groundedness, safety, critique, repair_needed, repair_type,
       repair_suggestion, raw_evaluation
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::jsonb)
     ON CONFLICT (request_event_id) DO UPDATE SET
       evaluator_model = EXCLUDED.evaluator_model,
       verdict = EXCLUDED.verdict,
       pre_answer_verdict = EXCLUDED.pre_answer_verdict,
       pre_answer_correctness = EXCLUDED.pre_answer_correctness,
       pre_answer_relevance = EXCLUDED.pre_answer_relevance,
       pre_answer_groundedness = EXCLUDED.pre_answer_groundedness,
       pre_answer_safety = EXCLUDED.pre_answer_safety,
       final_verdict = EXCLUDED.final_verdict,
       correction_effective = EXCLUDED.correction_effective,
       correction_critique = EXCLUDED.correction_critique,
       correctness = EXCLUDED.correctness,
       relevance = EXCLUDED.relevance,
       groundedness = EXCLUDED.groundedness,
       safety = EXCLUDED.safety,
       critique = EXCLUDED.critique,
       repair_needed = EXCLUDED.repair_needed,
       repair_type = EXCLUDED.repair_type,
       repair_suggestion = EXCLUDED.repair_suggestion,
       raw_evaluation = EXCLUDED.raw_evaluation,
       updated_at = NOW()
     RETURNING id`,
    [
      requestEventId,
      evaluatorModel,
      verdict,
      preAnswerVerdict,
      preAnswerCorrectness,
      preAnswerRelevance,
      preAnswerGroundedness,
      preAnswerSafety,
      finalVerdict || verdict,
      correctionEffective,
      String(correctionCritique || "").slice(0, 4000),
      correctness,
      relevance,
      groundedness,
      safety,
      String(critique || "").slice(0, 4000),
      Boolean(repairNeeded),
      repairType || "none",
      String(repairSuggestion || "").slice(0, 4000),
      JSON.stringify(rawEvaluation || {}),
    ]
  );
  return result.rows[0]?.id || null;
}

export async function saveJozLlmRepairCandidate({
  evaluationId,
  requestEventId,
  repairType = "knowledge",
  targetKey = null,
  proposedChange = "",
  evidence = {},
} = {}) {
  const result = await runQuery(
    `INSERT INTO joz_llm_repair_candidates (
       evaluation_id, request_event_id, repair_type, target_key,
       proposed_change, evidence
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id`,
    [
      evaluationId,
      requestEventId,
      repairType || "knowledge",
      targetKey,
      String(proposedChange || "").slice(0, 4000),
      JSON.stringify(evidence || {}),
    ]
  );
  return result.rows[0]?.id || null;
}

export async function reviewJozLlmRequestEvent({
  eventId,
  reviewStatus = "unreviewed",
  issueType = "",
  reviewNotes = "",
  approvedCorrection = "",
  reviewedBy = "dashboard",
} = {}) {
  const allowedStatuses = new Set(["unreviewed", "reviewed", "accepted", "rejected", "needs_followup"]);
  const status = allowedStatuses.has(reviewStatus) ? reviewStatus : "unreviewed";
  const result = await runQuery(
    `UPDATE joz_llm_request_events
     SET review_status = $2,
         issue_type = $3,
         review_notes = $4,
         approved_correction = $5,
         reviewed_by = $6,
         reviewed_at = NOW()
     WHERE id = $1
     RETURNING id, review_status, issue_type, review_notes, approved_correction,
               reviewed_by, reviewed_at`,
    [
      eventId,
      status,
      String(issueType || "").slice(0, 200),
      String(reviewNotes || "").slice(0, 4000),
      String(approvedCorrection || "").slice(0, 4000),
      String(reviewedBy || "dashboard").slice(0, 200),
    ]
  );
  return result.rows[0] || null;
}

export async function reviewJozLlmRepairCandidate({
  candidateId,
  action = "reject",
  reviewedBy = "dashboard",
  regressionReport = {},
} = {}) {
  const statusByAction = {
    approve: "approved",
    reject: "rejected",
    reset: "pending",
  };
  const status = statusByAction[action];
  if (!status) throw new Error("Unsupported repair review action");
  const result = await runQuery(
    `UPDATE joz_llm_repair_candidates
     SET status = $2,
         reviewed_by = $3,
         reviewed_at = NOW(),
         evidence = evidence || $4::jsonb
     WHERE id = $1
     RETURNING id, evaluation_id, request_event_id, repair_type, target_key,
               proposed_change, evidence, status, reviewed_by, reviewed_at,
               applied_at, created_at`,
    [
      candidateId,
      status,
      String(reviewedBy || "dashboard").slice(0, 200),
      JSON.stringify({ regressionGate: regressionReport || {} }),
    ]
  );
  return result.rows[0] || null;
}

export async function listRecentJozLlmEvaluations(limit = 100) {
  const result = await runQuery(
    `SELECT v.id, v.request_event_id, v.evaluator_model, v.verdict,
            v.pre_answer_verdict, v.pre_answer_correctness,
            v.pre_answer_relevance, v.pre_answer_groundedness,
            v.pre_answer_safety, v.final_verdict,
            v.correction_effective, v.correction_critique,
            v.correctness, v.relevance, v.groundedness, v.safety,
            v.critique, v.repair_needed, v.repair_type, v.repair_suggestion,
            v.raw_evaluation, v.created_at, v.updated_at,
            e.user_message, e.assistant_reply, e.route, e.created_at AS event_created_at
     FROM joz_llm_evaluations v
     JOIN joz_llm_request_events e ON e.id = v.request_event_id
     ORDER BY v.created_at DESC
     LIMIT $1`,
    [Math.max(1, Math.min(100, Number(limit) || 100))]
  );
  return result.rows || [];
}

export async function listJozLlmRepairCandidates(limit = 100) {
  const result = await runQuery(
    `SELECT c.id, c.evaluation_id, c.request_event_id, c.repair_type,
            c.target_key, c.proposed_change, c.evidence, c.status,
            c.reviewed_by, c.reviewed_at, c.applied_at, c.created_at,
            e.user_message, e.assistant_reply, e.route
     FROM joz_llm_repair_candidates c
     JOIN joz_llm_request_events e ON e.id = c.request_event_id
     ORDER BY c.created_at DESC
     LIMIT $1`,
    [Math.max(1, Math.min(100, Number(limit) || 100))]
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
  worldModelRetentionDays = 30,
} = {}) {
  const db = getPool();
  if (!db) {
    return {
      deletedConversations: 0,
      deletedCallbackRequests: 0,
      deletedPrivacyRequests: 0,
      deletedWorldModelTrajectories: 0,
      deletedWorldTransitionExperience: 0,
    };
  }

  const normalizedConversationDays = Math.max(1, Number(conversationRetentionDays) || 30);
  const normalizedCallbackDays = Math.max(1, Number(callbackRetentionDays) || 30);
  const normalizedPrivacyDays = Math.max(1, Number(privacyRequestRetentionDays) || 365);
  const normalizedWorldModelDays = Math.max(1, Number(worldModelRetentionDays) || 30);

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

  const worldTrajectoryDeleteResult = await runQuery(
    `DELETE FROM world_model_trajectories
     WHERE COALESCE(observed_at, created_at) < NOW() - ($1 * INTERVAL '1 day')
     RETURNING trajectory_id`,
    [normalizedWorldModelDays]
  );

  const worldExperienceDeleteResult = await runQuery(
    `DELETE FROM world_transition_experience
     WHERE COALESCE(last_observed_at, NOW()) < NOW() - ($1 * INTERVAL '1 day')
     RETURNING state_key`,
    [normalizedWorldModelDays]
  );

  const spatialOfferDeleteResult = await runQuery(
    `DELETE FROM world_model_spatial_offers
     WHERE expires_at < NOW()
     RETURNING offer_id`
  );

  return {
    deletedConversations: conversationDeleteResult.rows?.length || 0,
    deletedCallbackRequests: callbackDeleteResult.rows?.length || 0,
    deletedPrivacyRequests: privacyRequestDeleteResult.rows?.length || 0,
    deletedWorldModelTrajectories: worldTrajectoryDeleteResult.rows?.length || 0,
    deletedWorldTransitionExperience: worldExperienceDeleteResult.rows?.length || 0,
    deletedWorldModelSpatialOffers: spatialOfferDeleteResult.rows?.length || 0,
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
  const configuredDatabaseUrl = getDatabaseUrl();
  const db = getPool();
  if (!db) {
    if (isDatabaseRequired()) {
      throw new Error("Database is required in production. Configure SUPABASE_DB_URL or DATABASE_URL; local data fallback is disabled.");
    }
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
      CREATE TABLE IF NOT EXISTS joz_action_proposals (
        proposal_id TEXT PRIMARY KEY,
        session_key TEXT,
        action TEXT NOT NULL,
        risk TEXT NOT NULL DEFAULT 'unknown',
        proposal JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'pending',
        approval_token_hash TEXT NOT NULL,
        execution_token_hash TEXT,
        approved_by TEXT,
        result JSONB,
        verification JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        approved_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_action_events (
        id BIGSERIAL PRIMARY KEY,
        proposal_id TEXT NOT NULL REFERENCES joz_action_proposals(proposal_id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        actor TEXT NOT NULL DEFAULT 'system',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`CREATE INDEX IF NOT EXISTS joz_action_proposals_status_idx ON joz_action_proposals (status, created_at DESC)`);
    await db.query(`CREATE INDEX IF NOT EXISTS joz_action_events_proposal_idx ON joz_action_events (proposal_id, created_at ASC)`);

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
      CREATE TABLE IF NOT EXISTS world_model_trajectories (
        trajectory_id TEXT PRIMARY KEY,
        session_id TEXT,
        trace_id TEXT,
        schema_version TEXT NOT NULL DEFAULT '1.0',
        interaction_channel TEXT NOT NULL DEFAULT 'unknown',
        state_before JSONB NOT NULL DEFAULT '{}'::jsonb,
        state_history JSONB NOT NULL DEFAULT '[]'::jsonb,
        proposed_action JSONB NOT NULL DEFAULT '{}'::jsonb,
        symbolic_prediction JSONB NOT NULL DEFAULT '{}'::jsonb,
        probabilistic_prediction JSONB NOT NULL DEFAULT '{}'::jsonb,
        expected_effects JSONB NOT NULL DEFAULT '[]'::jsonb,
        observation_before JSONB,
        predicted_observation JSONB,
        observed_observation JSONB,
        observation_difference JSONB,
        observation_source_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
        observed_state JSONB,
        observed_effects JSONB NOT NULL DEFAULT '[]'::jsonb,
        intent TEXT,
        goal TEXT,
        transition_duration_ms INTEGER,
        success BOOLEAN,
        prediction_differences JSONB NOT NULL DEFAULT '{}'::jsonb,
        confidence_before_action NUMERIC(5,4),
        outcome_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
        model_version TEXT,
        transition_rule_version TEXT,
        shadow_latency_ms INTEGER,
        world_model_mode TEXT NOT NULL DEFAULT 'shadow',
        planner_selected_action JSONB,
        deterministic_approved_action JSONB,
        candidate_plans JSONB NOT NULL DEFAULT '[]'::jsonb,
        expected_observed_effects JSONB,
        field_support JSONB NOT NULL DEFAULT '{}'::jsonb,
        classification TEXT NOT NULL DEFAULT 'partial',
        failure_category TEXT,
        persistence_status TEXT NOT NULL DEFAULT 'pending',
        prediction_latency_ms INTEGER,
        observation_latency_ms INTEGER,
        sample_rate NUMERIC(5,4),
        sampled BOOLEAN NOT NULL DEFAULT TRUE,
        consent_compatible BOOLEAN NOT NULL DEFAULT TRUE,
        is_test BOOLEAN NOT NULL DEFAULT FALSE,
        is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
        exclusion_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        observed_at TIMESTAMPTZ
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS world_model_trajectories_created_idx
      ON world_model_trajectories (created_at DESC)
    `);

    await db.query(`
      ALTER TABLE world_model_trajectories
        ADD COLUMN IF NOT EXISTS observation_before JSONB,
        ADD COLUMN IF NOT EXISTS predicted_observation JSONB,
        ADD COLUMN IF NOT EXISTS observed_observation JSONB,
        ADD COLUMN IF NOT EXISTS observation_difference JSONB,
        ADD COLUMN IF NOT EXISTS observation_source_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS shadow_latency_ms INTEGER,
        ADD COLUMN IF NOT EXISTS world_model_mode TEXT NOT NULL DEFAULT 'shadow',
        ADD COLUMN IF NOT EXISTS planner_selected_action JSONB,
        ADD COLUMN IF NOT EXISTS deterministic_approved_action JSONB,
        ADD COLUMN IF NOT EXISTS candidate_plans JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS expected_observed_effects JSONB,
        ADD COLUMN IF NOT EXISTS field_support JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS classification TEXT NOT NULL DEFAULT 'partial',
        ADD COLUMN IF NOT EXISTS failure_category TEXT,
        ADD COLUMN IF NOT EXISTS persistence_status TEXT NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS prediction_latency_ms INTEGER,
        ADD COLUMN IF NOT EXISTS observation_latency_ms INTEGER,
        ADD COLUMN IF NOT EXISTS sample_rate NUMERIC(5,4),
        ADD COLUMN IF NOT EXISTS sampled BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS consent_compatible BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS exclusion_reason TEXT
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS world_model_trajectories_classification_idx
      ON world_model_trajectories (classification, created_at DESC)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS world_model_trajectories_session_idx
      ON world_model_trajectories (session_id, created_at DESC)
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS world_model_spatial_offers (
        offer_id TEXT PRIMARY KEY,
        entity_set TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'ar',
        asset_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
        graph_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS world_model_spatial_offers_expiry_idx
      ON world_model_spatial_offers (expires_at)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS world_model_spatial_offers_entity_idx
      ON world_model_spatial_offers (entity_set, created_at DESC)
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS world_transition_experience (
        state_key TEXT NOT NULL,
        action_key TEXT NOT NULL,
        next_state_key TEXT NOT NULL DEFAULT '',
        next_portal TEXT NOT NULL DEFAULT '',
        next_stage TEXT NOT NULL DEFAULT '',
        target_route TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        successes INTEGER NOT NULL DEFAULT 0,
        total_duration_ms BIGINT NOT NULL DEFAULT 0,
        total_prediction_error NUMERIC(12,4) NOT NULL DEFAULT 0,
        last_observed_at TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        PRIMARY KEY (state_key, action_key, next_state_key, next_portal, next_stage)
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS world_transition_experience_action_idx
      ON world_transition_experience (state_key, action_key)
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
      CREATE TABLE IF NOT EXISTS joz_datasets (
        id BIGSERIAL PRIMARY KEY,
        profile_id BIGINT NOT NULL REFERENCES joz_profiles(id) ON DELETE CASCADE,
        dataset_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        owner TEXT NOT NULL,
        classification TEXT NOT NULL DEFAULT 'public',
        visibility TEXT NOT NULL DEFAULT 'public',
        retention_policy TEXT NOT NULL DEFAULT 'until_withdrawn',
        schema_version TEXT NOT NULL DEFAULT '1.0',
        source_count INTEGER NOT NULL DEFAULT 0,
        normalized_count INTEGER NOT NULL DEFAULT 0,
        published_count INTEGER NOT NULL DEFAULT 0,
        model_ready_count INTEGER NOT NULL DEFAULT 0,
        verified_count INTEGER NOT NULL DEFAULT 0,
        content_checksum TEXT,
        status TEXT NOT NULL DEFAULT 'published',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (profile_id, dataset_id, tenant_id)
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_datasets_tenant_idx
      ON joz_datasets (tenant_id, dataset_id, status)
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_data_sources (
        id BIGSERIAL PRIMARY KEY,
        profile_id BIGINT NOT NULL REFERENCES joz_profiles(id) ON DELETE CASCADE,
        dataset_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_key TEXT NOT NULL,
        source_filename TEXT,
        source_uri TEXT,
        source_types JSONB NOT NULL DEFAULT '[]'::jsonb,
        owner TEXT NOT NULL,
        classification TEXT NOT NULL DEFAULT 'public',
        visibility TEXT NOT NULL DEFAULT 'public',
        retention_policy TEXT NOT NULL DEFAULT 'until_withdrawn',
        record_count INTEGER NOT NULL DEFAULT 0,
        model_ready_count INTEGER NOT NULL DEFAULT 0,
        verified_count INTEGER NOT NULL DEFAULT 0,
        evidence_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
        source_checksum TEXT,
        status TEXT NOT NULL DEFAULT 'published',
        last_ingested_at TIMESTAMPTZ,
        last_published_at TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (profile_id, dataset_id, tenant_id, source_key)
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_data_sources_tenant_idx
      ON joz_data_sources (tenant_id, dataset_id, status)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_data_sources_source_id_idx
      ON joz_data_sources (source_id)
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
        review_status TEXT NOT NULL DEFAULT 'unreviewed',
        issue_type TEXT NOT NULL DEFAULT '',
        review_notes TEXT NOT NULL DEFAULT '',
        approved_correction TEXT NOT NULL DEFAULT '',
        reviewed_by TEXT,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const statement of [
      `ALTER TABLE joz_llm_request_events ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'unreviewed'`,
      `ALTER TABLE joz_llm_request_events ADD COLUMN IF NOT EXISTS issue_type TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE joz_llm_request_events ADD COLUMN IF NOT EXISTS review_notes TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE joz_llm_request_events ADD COLUMN IF NOT EXISTS approved_correction TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE joz_llm_request_events ADD COLUMN IF NOT EXISTS reviewed_by TEXT`,
      `ALTER TABLE joz_llm_request_events ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`,
    ]) {
      await db.query(statement);
    }

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_llm_request_events_created_idx
      ON joz_llm_request_events (created_at DESC)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_llm_request_events_route_idx
      ON joz_llm_request_events (route, created_at DESC)
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_causal_tool_runs (
        run_id UUID PRIMARY KEY,
        request_id TEXT,
        conversation_id UUID REFERENCES joz_conversations(id) ON DELETE SET NULL,
        session_key TEXT,
        tenant_id TEXT NOT NULL DEFAULT 'public',
        principal_id TEXT,
        tool_name TEXT NOT NULL,
        arguments JSONB NOT NULL DEFAULT '{}'::jsonb,
        mode TEXT NOT NULL DEFAULT 'shadow',
        status TEXT NOT NULL DEFAULT 'authorized',
        authorization JSONB NOT NULL DEFAULT '{}'::jsonb,
        result JSONB,
        error_code TEXT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_causal_tool_runs_created_idx
      ON joz_causal_tool_runs (started_at DESC)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_causal_tool_runs_tenant_idx
      ON joz_causal_tool_runs (tenant_id, started_at DESC)
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_causal_datasets (
        dataset_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'public',
        owner TEXT NOT NULL DEFAULT 'joz',
        classification TEXT NOT NULL DEFAULT 'public',
        visibility TEXT NOT NULL DEFAULT 'public',
        status TEXT NOT NULL DEFAULT 'draft',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_causal_dataset_versions (
        dataset_id TEXT NOT NULL REFERENCES joz_causal_datasets(dataset_id) ON DELETE CASCADE,
        model_version TEXT NOT NULL,
        schema_version TEXT NOT NULL DEFAULT 'joz.causal-dataset.v1',
        graph JSONB NOT NULL DEFAULT '{}'::jsonb,
        factual JSONB,
        checksum TEXT,
        row_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (dataset_id, model_version)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_causal_dataset_variables (
        dataset_id TEXT NOT NULL,
        model_version TEXT NOT NULL,
        variable_id TEXT NOT NULL,
        label TEXT,
        data_type TEXT NOT NULL DEFAULT 'numeric',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        PRIMARY KEY (dataset_id, model_version, variable_id),
        FOREIGN KEY (dataset_id, model_version)
          REFERENCES joz_causal_dataset_versions(dataset_id, model_version) ON DELETE CASCADE
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_causal_dataset_observations (
        dataset_id TEXT NOT NULL,
        model_version TEXT NOT NULL,
        row_index INTEGER NOT NULL,
        row_values JSONB NOT NULL,
        PRIMARY KEY (dataset_id, model_version, row_index),
        FOREIGN KEY (dataset_id, model_version)
          REFERENCES joz_causal_dataset_versions(dataset_id, model_version) ON DELETE CASCADE
      )
    `);

    await db.query(`CREATE INDEX IF NOT EXISTS joz_causal_datasets_tenant_idx ON joz_causal_datasets (tenant_id, status)`);
    await db.query(`CREATE INDEX IF NOT EXISTS joz_causal_dataset_versions_status_idx ON joz_causal_dataset_versions (status, published_at DESC)`);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_llm_evaluations (
        id BIGSERIAL PRIMARY KEY,
        request_event_id BIGINT NOT NULL UNIQUE REFERENCES joz_llm_request_events(id) ON DELETE CASCADE,
        evaluator_model TEXT NOT NULL,
        verdict TEXT NOT NULL DEFAULT 'warn',
        pre_answer_verdict TEXT,
        pre_answer_correctness NUMERIC(4,2),
        pre_answer_relevance NUMERIC(4,2),
        pre_answer_groundedness NUMERIC(4,2),
        pre_answer_safety NUMERIC(4,2),
        final_verdict TEXT,
        correction_effective BOOLEAN,
        correction_critique TEXT NOT NULL DEFAULT '',
        correctness NUMERIC(4,2),
        relevance NUMERIC(4,2),
        groundedness NUMERIC(4,2),
        safety NUMERIC(4,2),
        critique TEXT NOT NULL DEFAULT '',
        repair_needed BOOLEAN NOT NULL DEFAULT FALSE,
        repair_type TEXT NOT NULL DEFAULT 'none',
        repair_suggestion TEXT NOT NULL DEFAULT '',
        raw_evaluation JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const statement of [
      `ALTER TABLE joz_llm_evaluations ADD COLUMN IF NOT EXISTS pre_answer_verdict TEXT`,
      `ALTER TABLE joz_llm_evaluations ADD COLUMN IF NOT EXISTS pre_answer_correctness NUMERIC(4,2)`,
      `ALTER TABLE joz_llm_evaluations ADD COLUMN IF NOT EXISTS pre_answer_relevance NUMERIC(4,2)`,
      `ALTER TABLE joz_llm_evaluations ADD COLUMN IF NOT EXISTS pre_answer_groundedness NUMERIC(4,2)`,
      `ALTER TABLE joz_llm_evaluations ADD COLUMN IF NOT EXISTS pre_answer_safety NUMERIC(4,2)`,
      `ALTER TABLE joz_llm_evaluations ADD COLUMN IF NOT EXISTS final_verdict TEXT`,
      `ALTER TABLE joz_llm_evaluations ADD COLUMN IF NOT EXISTS correction_effective BOOLEAN`,
      `ALTER TABLE joz_llm_evaluations ADD COLUMN IF NOT EXISTS correction_critique TEXT NOT NULL DEFAULT ''`,
    ]) {
      await db.query(statement);
    }

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_llm_evaluations_verdict_idx
      ON joz_llm_evaluations (verdict, created_at DESC)
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_llm_repair_candidates (
        id BIGSERIAL PRIMARY KEY,
        evaluation_id BIGINT NOT NULL REFERENCES joz_llm_evaluations(id) ON DELETE CASCADE,
        request_event_id BIGINT NOT NULL REFERENCES joz_llm_request_events(id) ON DELETE CASCADE,
        repair_type TEXT NOT NULL,
        target_key TEXT,
        proposed_change TEXT NOT NULL,
        evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by TEXT,
        reviewed_at TIMESTAMPTZ,
        applied_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_llm_repairs_status_idx
      ON joz_llm_repair_candidates (status, created_at DESC)
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
      CREATE TABLE IF NOT EXISTS joz_consultant_assessments (
        id UUID PRIMARY KEY,
        session_key TEXT,
        status TEXT NOT NULL DEFAULT 'discovery_in_progress',
        profile JSONB NOT NULL DEFAULT '{}'::jsonb,
        analysis JSONB,
        version TEXT NOT NULL DEFAULT 'world-model-consultant-mvp-1',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_consultant_assessments_session_idx
      ON joz_consultant_assessments (session_key, updated_at DESC)
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_consultant_assessment_messages (
        id BIGSERIAL PRIMARY KEY,
        assessment_id UUID NOT NULL REFERENCES joz_consultant_assessments(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        field TEXT,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_consultant_messages_assessment_idx
      ON joz_consultant_assessment_messages (assessment_id, created_at ASC)
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS joz_consultant_leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        assessment_id UUID REFERENCES joz_consultant_assessments(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        company TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT '',
        engagement TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS joz_consultant_leads_created_idx
      ON joz_consultant_leads (created_at DESC)
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
    if (pool) {
      await pool.end().catch(() => {});
      pool = null;
    }

    if (configuredDatabaseUrl) {
      console.error("❌ Database init failed; Supabase/Postgres is required:", error.message);
      throw error;
    }

    console.error("⚠️ Database init failed, using file memory:", error.message);
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

export async function getWorldTransitionExperience({ stateKey = "", actionKey = "" } = {}) {
  if (!stateKey || !actionKey) return [];
  const result = await runQuery(
    `SELECT
       state_key,
       action_key,
       next_state_key,
       next_portal,
       next_stage,
       target_route,
       attempts,
       successes,
       (total_duration_ms / NULLIF(attempts, 0)) AS average_duration_ms,
       (total_prediction_error / NULLIF(attempts, 0)) AS average_prediction_error,
       last_observed_at,
       metadata
     FROM world_transition_experience
     WHERE state_key = $1 AND action_key = $2
     ORDER BY attempts DESC, last_observed_at DESC NULLS LAST`,
    [stateKey, actionKey]
  );
  return result.rows || [];
}

export async function listWorldModelTrajectories({
  from = null,
  to = null,
  schemaVersion = null,
  limit = 10_000,
} = {}) {
  const safeLimit = Math.min(50_000, Math.max(1, Number(limit) || 10_000));
  const filters = [];
  const values = [];
  if (from) {
    values.push(from);
    filters.push(`COALESCE(observed_at, created_at) >= $${values.length}`);
  }
  if (to) {
    values.push(to);
    filters.push(`COALESCE(observed_at, created_at) < $${values.length}`);
  }
  if (schemaVersion) {
    values.push(String(schemaVersion));
    filters.push(`schema_version = $${values.length}`);
  }
  values.push(safeLimit);
  const result = await runQuery(
    `SELECT trajectory_id, session_id, trace_id, schema_version,
            interaction_channel, state_before, state_history, proposed_action,
            symbolic_prediction, probabilistic_prediction, expected_effects,
            observation_before, predicted_observation, observed_observation,
            observation_difference, observation_source_versions, observed_state,
            observed_effects, intent, goal, transition_duration_ms, success,
            prediction_differences, confidence_before_action, outcome_scores,
            model_version, transition_rule_version, shadow_latency_ms,
            world_model_mode, planner_selected_action, deterministic_approved_action,
            candidate_plans, expected_observed_effects, field_support,
            classification, failure_category, persistence_status,
            prediction_latency_ms, observation_latency_ms, sample_rate, sampled,
            consent_compatible, is_test, is_synthetic, exclusion_reason,
            created_at, observed_at
       FROM world_model_trajectories
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY COALESCE(observed_at, created_at), trajectory_id
      LIMIT $${values.length}`,
    values
  );
  return result.rows || [];
}

export async function recordWorldModelTrajectory(input = {}) {
  const actionCandidates = [
    input.proposedAction,
    input.symbolicPrediction?.actions?.[0],
    input.plannerSelectedAction,
    input.plannerSelected?.actions?.[0],
    input.deterministicApprovedAction,
  ];
  const proposedAction = actionCandidates.find((candidate) => {
    if (candidate == null || candidate === "") return false;
    const value = typeof candidate === "string"
      ? candidate
      : candidate?.type || candidate?.action || candidate?.id;
    return value && !["unknown", "noop", "null"].includes(String(value).trim().toLowerCase());
  }) || null;
  const normalized = normalizeWorldTrajectoryRecord({ ...input, proposedAction });
  if (!normalized.valid) {
    const error = new Error(`Invalid world trajectory: ${normalized.errors.join(", ")}`);
    error.status = 400;
    throw error;
  }

  const record = normalized.record;
  const stateBefore = record.stateBefore || {};
  const observedState = record.observedState || {};
  const stateKey = String(stateBefore.currentStateKey || stateBefore.portal || "unknown");
  const actionKey = String(
    record.proposedAction?.type ||
      record.proposedAction?.action ||
      record.proposedAction ||
      "unknown"
  );
  const nextStateKey = String(observedState.currentStateKey || observedState.portal || "unknown");
  const nextPortal = String(observedState.portal || "");
  const nextStage = String(observedState.stage || "");
  const errorCount = Number(record.predictionDifferences?.metrics?.mismatchCount || 0);
  const success = record.success === true;

  await runQuery(
    `INSERT INTO world_model_trajectories (
       trajectory_id, session_id, trace_id, schema_version, interaction_channel,
       state_before, state_history, proposed_action, symbolic_prediction,
       probabilistic_prediction, expected_effects, observation_before,
       predicted_observation, observed_observation,
       observation_difference, observation_source_versions, observed_state,
       observed_effects, intent, goal,
       transition_duration_ms, success, prediction_differences,
       confidence_before_action, outcome_scores, model_version, transition_rule_version,
       shadow_latency_ms, world_model_mode, planner_selected_action,
       deterministic_approved_action, candidate_plans, expected_observed_effects,
       field_support, classification, failure_category, persistence_status,
       prediction_latency_ms, observation_latency_ms, sample_rate, sampled,
       consent_compatible, is_test, is_synthetic, exclusion_reason, created_at, observed_at
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb,
       $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb,
       $16::jsonb, $17::jsonb, $18::jsonb, $19, $20, $21, $22, $23::jsonb,
       $24, $25::jsonb, $26, $27, $28, $29, $30, $31, $32::jsonb,
       $33::jsonb, $34::jsonb, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45,
       $46, $47)
     ON CONFLICT (trajectory_id) DO UPDATE SET
       proposed_action = CASE WHEN EXCLUDED.proposed_action <> '{}'::jsonb THEN EXCLUDED.proposed_action ELSE world_model_trajectories.proposed_action END,
       symbolic_prediction = CASE WHEN EXCLUDED.symbolic_prediction <> '{}'::jsonb THEN EXCLUDED.symbolic_prediction ELSE world_model_trajectories.symbolic_prediction END,
       probabilistic_prediction = CASE WHEN EXCLUDED.probabilistic_prediction <> '{}'::jsonb THEN EXCLUDED.probabilistic_prediction ELSE world_model_trajectories.probabilistic_prediction END,
       expected_effects = CASE WHEN jsonb_array_length(EXCLUDED.expected_effects) > 0 THEN EXCLUDED.expected_effects ELSE world_model_trajectories.expected_effects END,
       observation_before = EXCLUDED.observation_before,
       predicted_observation = EXCLUDED.predicted_observation,
       observed_state = CASE WHEN EXCLUDED.observed_state <> '{}'::jsonb THEN EXCLUDED.observed_state ELSE world_model_trajectories.observed_state END,
       observed_observation = CASE WHEN EXCLUDED.observed_observation <> '{}'::jsonb THEN EXCLUDED.observed_observation ELSE world_model_trajectories.observed_observation END,
       observation_difference = CASE WHEN EXCLUDED.observation_difference <> '{}'::jsonb THEN EXCLUDED.observation_difference ELSE world_model_trajectories.observation_difference END,
       observation_source_versions = CASE WHEN EXCLUDED.observation_source_versions <> '{}'::jsonb THEN EXCLUDED.observation_source_versions ELSE world_model_trajectories.observation_source_versions END,
       observed_effects = CASE WHEN jsonb_array_length(EXCLUDED.observed_effects) > 0 THEN EXCLUDED.observed_effects ELSE world_model_trajectories.observed_effects END,
       transition_duration_ms = COALESCE(EXCLUDED.transition_duration_ms, world_model_trajectories.transition_duration_ms),
       success = COALESCE(EXCLUDED.success, world_model_trajectories.success),
       prediction_differences = CASE WHEN EXCLUDED.prediction_differences <> '{}'::jsonb THEN EXCLUDED.prediction_differences ELSE world_model_trajectories.prediction_differences END,
       outcome_scores = EXCLUDED.outcome_scores,
       shadow_latency_ms = EXCLUDED.shadow_latency_ms,
       world_model_mode = COALESCE(EXCLUDED.world_model_mode, world_model_trajectories.world_model_mode),
       planner_selected_action = COALESCE(EXCLUDED.planner_selected_action, world_model_trajectories.planner_selected_action),
       deterministic_approved_action = COALESCE(EXCLUDED.deterministic_approved_action, world_model_trajectories.deterministic_approved_action),
       candidate_plans = CASE WHEN jsonb_array_length(EXCLUDED.candidate_plans) > 0 THEN EXCLUDED.candidate_plans ELSE world_model_trajectories.candidate_plans END,
       expected_observed_effects = COALESCE(EXCLUDED.expected_observed_effects, world_model_trajectories.expected_observed_effects),
       field_support = CASE WHEN EXCLUDED.field_support <> '{}'::jsonb THEN EXCLUDED.field_support ELSE world_model_trajectories.field_support END,
       classification = CASE
         WHEN EXCLUDED.classification = 'partial'
           AND (
             world_model_trajectories.observed_state <> '{}'::jsonb
             OR EXCLUDED.observed_state <> '{}'::jsonb
           )
           AND (
             world_model_trajectories.symbolic_prediction <> '{}'::jsonb
             OR EXCLUDED.symbolic_prediction <> '{}'::jsonb
           )
           THEN 'valid'
         WHEN EXCLUDED.classification = 'partial'
           AND world_model_trajectories.classification IN ('valid', 'unsupported', 'invalid_action')
           THEN world_model_trajectories.classification
         ELSE COALESCE(EXCLUDED.classification, world_model_trajectories.classification)
       END,
       failure_category = COALESCE(EXCLUDED.failure_category, world_model_trajectories.failure_category),
       persistence_status = EXCLUDED.persistence_status,
       prediction_latency_ms = COALESCE(EXCLUDED.prediction_latency_ms, world_model_trajectories.prediction_latency_ms),
       observation_latency_ms = COALESCE(EXCLUDED.observation_latency_ms, world_model_trajectories.observation_latency_ms),
       sample_rate = COALESCE(EXCLUDED.sample_rate, world_model_trajectories.sample_rate),
       sampled = EXCLUDED.sampled,
       consent_compatible = EXCLUDED.consent_compatible,
       is_test = EXCLUDED.is_test,
       is_synthetic = EXCLUDED.is_synthetic,
       exclusion_reason = COALESCE(EXCLUDED.exclusion_reason, world_model_trajectories.exclusion_reason),
       observed_at = COALESCE(EXCLUDED.observed_at, world_model_trajectories.observed_at)`,
    [
      record.trajectoryId,
      record.sessionId,
      record.traceId,
      record.schemaVersion,
      record.interactionChannel,
      JSON.stringify(record.stateBefore || {}),
      JSON.stringify(record.stateHistory || []),
      JSON.stringify(record.proposedAction || {}),
      JSON.stringify(record.symbolicPrediction || {}),
      JSON.stringify(record.probabilisticPrediction || {}),
      JSON.stringify(record.expectedEffects || []),
      JSON.stringify(record.observationBefore || {}),
      JSON.stringify(record.predictedObservation || {}),
      JSON.stringify(record.observedObservation || {}),
      JSON.stringify(record.observationDifference || {}),
      JSON.stringify(record.observationSourceVersions || {}),
      JSON.stringify(record.observedState || {}),
      JSON.stringify(record.observedEffects || []),
      record.intent,
      record.goal,
      record.transitionDurationMs,
      record.success,
      JSON.stringify(record.predictionDifferences || {}),
      record.confidenceBeforeAction,
      JSON.stringify(record.outcomeScores || {}),
      record.modelVersion,
      record.transitionRuleVersion,
      record.shadowLatencyMs,
      record.worldModelMode,
      JSON.stringify(record.plannerSelectedAction || null),
      JSON.stringify(record.deterministicApprovedAction || null),
      JSON.stringify(record.candidatePlans || []),
      JSON.stringify(record.expectedObservedEffects || null),
      JSON.stringify(record.fieldSupport || {}),
      record.classification,
      record.failureCategory,
      record.persistenceStatus,
      record.predictionLatencyMs,
      record.observationLatencyMs,
      record.sampleRate,
      record.sampled,
      record.consentCompatible,
      record.isTest,
      record.isSynthetic,
      record.exclusionReason,
      record.createdAt,
      record.observedAt,
    ]
  );

  if (record.observedState) {
  await runQuery(
    `INSERT INTO world_transition_experience (
       state_key, action_key, next_state_key, next_portal, next_stage, target_route,
       attempts, successes, total_duration_ms, total_prediction_error,
       last_observed_at, metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, $9, $10, $11::jsonb)
     ON CONFLICT (state_key, action_key, next_state_key, next_portal, next_stage)
     DO UPDATE SET
       attempts = world_transition_experience.attempts + 1,
       successes = world_transition_experience.successes + EXCLUDED.successes,
       total_duration_ms = world_transition_experience.total_duration_ms + EXCLUDED.total_duration_ms,
       total_prediction_error = world_transition_experience.total_prediction_error + EXCLUDED.total_prediction_error,
       last_observed_at = EXCLUDED.last_observed_at,
       metadata = EXCLUDED.metadata`,
    [
      stateKey,
      actionKey,
      nextStateKey,
      nextPortal,
      nextStage,
      String(observedState.targetRoute || stateBefore.targetRoute || ""),
      success ? 1 : 0,
      Math.max(0, Math.round(Number(record.transitionDurationMs) || 0)),
      Math.max(0, errorCount),
      record.observedAt || new Date().toISOString(),
      JSON.stringify({ schemaVersion: record.schemaVersion, modelVersion: record.modelVersion }),
    ]
  );
  }

  return {
    trajectoryId: record.trajectoryId,
    stateKey,
    actionKey,
    nextStateKey,
    persisted: isDatabaseEnabled(),
  };
}

export async function createWorldModelSpatialOffer(input = {}) {
  const {
    offerId,
    entitySet,
    mode = "ar",
    assetManifest = {},
    graphEvidence = {},
    metadata = {},
    createdAt = new Date().toISOString(),
    expiresAt,
  } = input;

  if (!offerId || !entitySet || !expiresAt) {
    const error = new Error("Invalid spatial offer: offerId, entitySet, and expiresAt are required");
    error.status = 400;
    throw error;
  }

  const result = await runQuery(
    `INSERT INTO world_model_spatial_offers (
       offer_id, entity_set, mode, asset_manifest, graph_evidence, metadata,
       created_at, expires_at
     )
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8)
     ON CONFLICT (offer_id) DO UPDATE SET
       entity_set = EXCLUDED.entity_set,
       mode = EXCLUDED.mode,
       asset_manifest = EXCLUDED.asset_manifest,
       graph_evidence = EXCLUDED.graph_evidence,
       metadata = EXCLUDED.metadata,
       expires_at = EXCLUDED.expires_at
     RETURNING offer_id, entity_set, mode, asset_manifest, graph_evidence,
       metadata, created_at, expires_at, consumed_at`,
    [
      offerId,
      entitySet,
      mode,
      JSON.stringify(assetManifest || {}),
      JSON.stringify(graphEvidence || {}),
      JSON.stringify(metadata || {}),
      createdAt,
      expiresAt,
    ]
  );

  return result.rows?.[0] || null;
}

export async function getWorldModelSpatialOffer(offerId) {
  const id = String(offerId || "").trim();
  if (!id) return null;
  const result = await runQuery(
    `SELECT offer_id, entity_set, mode, asset_manifest, graph_evidence,
            metadata, created_at, expires_at, consumed_at
       FROM world_model_spatial_offers
      WHERE offer_id = $1
      LIMIT 1`,
    [id]
  );
  return result.rows?.[0] || null;
}

export async function markWorldModelSpatialOfferConsumed(offerId) {
  const id = String(offerId || "").trim();
  if (!id) return null;
  const result = await runQuery(
    `UPDATE world_model_spatial_offers
        SET consumed_at = COALESCE(consumed_at, NOW())
      WHERE offer_id = $1
      RETURNING offer_id, entity_set, mode, asset_manifest, graph_evidence,
        metadata, created_at, expires_at, consumed_at`,
    [id]
  );
  return result.rows?.[0] || null;
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

export async function createJozAIComplianceIncident({
  companyKey = null,
  reporterId = null,
  category,
  severity = "medium",
  description,
  containment = null,
} = {}) {
  const db = getPool();
  if (!db) return null;
  const result = await db.query(
    `
      INSERT INTO joz_ai_compliance_incidents (
        company_key, reporter_id, category, severity, description, containment
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, company_key, reporter_id, category, severity, description,
        containment, status, created_at, updated_at, resolved_at
    `,
    [companyKey, reporterId, category, severity, description, containment],
  );
  return result.rows[0] || null;
}
