import pg from "pg";
import { getJozLaneConfig, normalizeJozLaneIntent } from "./shared/jozLlmLanes.js";

const { Pool } = pg;

let pool = null;

function getDatabaseUrl() {
  return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
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

export async function getJozDocumentsByIntent(intentMode = "skills", limit = 8) {
  const primaryCategory = normalizeJozLaneIntent(intentMode);
  const lane = getJozLaneConfig(primaryCategory);
  const categories = lane?.retrievalCategories || [primaryCategory, "case_study", "proof", "bio", "faq"];
  const result = await runQuery(
    `SELECT title, category, summary, body, metadata
     FROM joz_documents
     WHERE category = ANY($1::text[])
     ORDER BY
       CASE
         WHEN category = $2 THEN 0
         WHEN COALESCE(metadata->>'lane', '') = $2 THEN 1
         WHEN category = 'proof' THEN 2
         WHEN category = 'bio' THEN 3
         WHEN category = 'faq' THEN 4
         ELSE 5
       END,
       updated_at DESC,
       id ASC
     LIMIT $3`,
    [categories, primaryCategory, limit]
  );
  return result.rows;
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
