-- Business Value Diagnostic control plane
-- Apply after server/supabase-schema.sql. All diagnostic conclusions remain
-- hypotheses until evidence and an explicit confirmation event are recorded.

CREATE TABLE IF NOT EXISTS joz_business_value_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES joz_conversations(id) ON DELETE SET NULL,
  session_key TEXT,
  company_key TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'ready_for_review', 'verified', 'closed')),
  active_node TEXT NOT NULL DEFAULT 'data'
    CHECK (active_node IN ('data', 'control', 'oversight', 'adoption')),
  diagnosis JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0,
  approval JSONB NOT NULL DEFAULT '{}'::jsonb,
  solution_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS joz_business_value_cases_session_idx
  ON joz_business_value_cases (session_key, updated_at DESC);

CREATE INDEX IF NOT EXISTS joz_business_value_cases_company_idx
  ON joz_business_value_cases (company_key, updated_at DESC);

CREATE TABLE IF NOT EXISTS joz_business_value_case_events (
  id BIGSERIAL PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES joz_business_value_cases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'case_opened',
      'observation_added',
      'hypothesis_created',
      'evidence_requested',
      'evidence_added',
      'diagnosis_updated',
      'approval_requested',
      'approval_received',
      'solution_proposed',
      'verification_requested',
      'diagnosis_verified',
      'case_closed'
    )),
  actor TEXT NOT NULL DEFAULT 'joz_llm',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_message_id UUID REFERENCES joz_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS joz_business_value_case_events_case_idx
  ON joz_business_value_case_events (case_id, created_at ASC);

CREATE TABLE IF NOT EXISTS joz_business_value_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES joz_business_value_cases(id) ON DELETE CASCADE,
  evidence_key TEXT NOT NULL,
  node TEXT NOT NULL
    CHECK (node IN ('data', 'control', 'oversight', 'adoption')),
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_type TEXT NOT NULL DEFAULT 'conversation',
  source_ref TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'claimed', 'corroborated', 'verified', 'rejected')),
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  UNIQUE (case_id, evidence_key)
);

CREATE INDEX IF NOT EXISTS joz_business_value_evidence_case_idx
  ON joz_business_value_evidence (case_id, node, verification_status);
