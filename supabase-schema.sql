CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
);

CREATE TABLE IF NOT EXISTS joz_profile_capabilities (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES joz_profiles(id) ON DELETE CASCADE,
  capability_type TEXT NOT NULL,
  capability_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, capability_type, capability_key)
);

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
);

CREATE TABLE IF NOT EXISTS joz_document_chunks (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES joz_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding_model TEXT,
  embedding VECTOR(1536),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS joz_documents_category_idx
  ON joz_documents (profile_id, category);

CREATE INDEX IF NOT EXISTS joz_document_chunks_document_idx
  ON joz_document_chunks (document_id, chunk_index);

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
);

CREATE INDEX IF NOT EXISTS joz_conversations_profile_idx
  ON joz_conversations (profile_id, created_at DESC);

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
);

CREATE INDEX IF NOT EXISTS joz_messages_conversation_idx
  ON joz_messages (conversation_id, created_at ASC);

CREATE TABLE IF NOT EXISTS joz_business_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES joz_conversations(id) ON DELETE SET NULL,
  profile_id BIGINT REFERENCES joz_profiles(id) ON DELETE SET NULL,
  company_name TEXT,
  contact_name TEXT,
  contact_email TEXT,
  role_title TEXT,
  problem_statement TEXT NOT NULL,
  desired_outcome TEXT,
  budget_band TEXT,
  timeline TEXT,
  urgency TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS joz_booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES joz_conversations(id) ON DELETE SET NULL,
  profile_id BIGINT REFERENCES joz_profiles(id) ON DELETE SET NULL,
  contact_name TEXT,
  contact_email TEXT NOT NULL,
  company_name TEXT,
  request_type TEXT NOT NULL DEFAULT 'intro_call',
  request_notes TEXT,
  preferred_timeframe TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO joz_profiles (
  slug,
  display_name,
  label,
  headline,
  summary,
  website_url,
  email,
  phone,
  location,
  is_primary
)
VALUES (
  'jozef-krupa',
  'Jozef Krupa',
  'Joz LLM',
  'Agentic AI architect and applied AI product leader.',
  'Primary profile backing the Joz LLM agent, including skills, case studies, mindset, and business-fit knowledge.',
  'https://meetjoz.com',
  'joz@meetjoz.com',
  '+421 952 538 970',
  'Bratislava, Slovakia / Singapore / Dubai / Zurich',
  TRUE
)
ON CONFLICT (slug)
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  label = EXCLUDED.label,
  headline = EXCLUDED.headline,
  summary = EXCLUDED.summary,
  website_url = EXCLUDED.website_url,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  location = EXCLUDED.location,
  is_primary = EXCLUDED.is_primary,
  updated_at = NOW();
