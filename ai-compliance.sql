-- AI governance and incident register
-- Apply after server/supabase-schema.sql and server/business-value-diagnostic.sql.

CREATE TABLE IF NOT EXISTS joz_ai_compliance_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_key TEXT,
  reporter_id TEXT,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  containment TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'contained', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS joz_ai_compliance_incidents_company_idx
  ON joz_ai_compliance_incidents (company_key, created_at DESC);

CREATE INDEX IF NOT EXISTS joz_ai_compliance_incidents_status_idx
  ON joz_ai_compliance_incidents (status, severity, created_at DESC);
