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
);

CREATE INDEX IF NOT EXISTS world_model_trajectories_created_idx
  ON world_model_trajectories (created_at DESC);

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
  ADD COLUMN IF NOT EXISTS exclusion_reason TEXT;

CREATE INDEX IF NOT EXISTS world_model_trajectories_classification_idx
  ON world_model_trajectories (classification, created_at DESC);

CREATE INDEX IF NOT EXISTS world_model_trajectories_session_idx
  ON world_model_trajectories (session_id, created_at DESC);

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
);

CREATE INDEX IF NOT EXISTS world_transition_experience_action_idx
  ON world_transition_experience (state_key, action_key);

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
