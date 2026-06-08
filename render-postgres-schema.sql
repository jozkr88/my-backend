CREATE TABLE IF NOT EXISTS portal_transitions (
  portal_key TEXT NOT NULL,
  current_state TEXT NOT NULL,
  command_key TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  awareness TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (portal_key, current_state, command_key)
);

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
);

CREATE TABLE IF NOT EXISTS world_portals (
  portal_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  route TEXT,
  summary TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS world_states (
  portal_key TEXT NOT NULL,
  state_key TEXT NOT NULL,
  name TEXT NOT NULL,
  summary TEXT,
  is_entry BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (portal_key, state_key)
);

CREATE TABLE IF NOT EXISTS world_actions (
  action_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  kind TEXT,
  summary TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
);

CREATE TABLE IF NOT EXISTS world_object_aliases (
  object_key TEXT NOT NULL,
  alias TEXT NOT NULL,
  PRIMARY KEY (object_key, alias)
);

CREATE TABLE IF NOT EXISTS world_state_actions (
  state_key TEXT NOT NULL,
  action_key TEXT NOT NULL,
  PRIMARY KEY (state_key, action_key)
);

CREATE TABLE IF NOT EXISTS world_state_transitions (
  state_key TEXT NOT NULL,
  action_key TEXT NOT NULL,
  next_state_key TEXT,
  target_route TEXT,
  awareness TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (state_key, action_key)
);

CREATE TABLE IF NOT EXISTS world_transition_phrases (
  state_key TEXT NOT NULL,
  action_key TEXT NOT NULL,
  phrase TEXT NOT NULL,
  PRIMARY KEY (state_key, action_key, phrase)
);

INSERT INTO portal_transitions (portal_key, current_state, command_key, action, target, awareness)
VALUES
  ('meet-joz', 'vibe', 'flex', 'vibe', NULL, 'Opening Ascend.'),
  ('meet-joz', 'discover', 'ascend', 'discover', NULL, 'Opening Mogg.'),
  ('meet-joz', 'skills', 'mogg', 'skills', NULL, 'Opening workf.'),
  ('meet-joz', 'vibe', 'back', 'vibe_back', '/', NULL),
  ('meet-joz', 'discover', 'back', 'vibe_back', NULL, NULL),
  ('meet-joz', 'skills', 'back', 'vibe_back1', NULL, NULL),
  ('meet-joz', 'vibe', 'pause', 'pause', NULL, NULL),
  ('meet-joz', 'discover', 'pause', 'pause', NULL, NULL),
  ('meet-joz', 'skills', 'pause', 'pause', NULL, NULL),
  ('meet-joz', 'vibe', 'resume', 'resume', NULL, NULL),
  ('meet-joz', 'discover', 'resume', 'resume', NULL, NULL),
  ('meet-joz', 'skills', 'resume', 'resume', NULL, NULL),
  ('meet-joz', 'vibe', 'exit', 'back', '/', NULL),
  ('meet-joz', 'discover', 'exit', 'back', '/', NULL),
  ('meet-joz', 'skills', 'exit', 'back', '/', NULL),
  ('meet-joz', 'vibe', 'launch', 'launch_in_space_workf', NULL, NULL),
  ('meet-joz', 'discover', 'launch', 'launch_in_space_workf', NULL, NULL),
  ('meet-joz', 'skills', 'launch', 'launch_in_space_workf', NULL, NULL)
ON CONFLICT (portal_key, current_state, command_key)
DO UPDATE SET
  action = EXCLUDED.action,
  target = EXCLUDED.target,
  awareness = EXCLUDED.awareness,
  updated_at = NOW();
