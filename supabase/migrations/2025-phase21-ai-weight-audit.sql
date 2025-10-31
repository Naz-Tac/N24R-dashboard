-- Phase 21: AI Weight Audit Table
-- Tracks all weight recalibration events for transparency and debugging

CREATE TABLE IF NOT EXISTS ai_weight_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_weights JSONB NOT NULL,
  new_weights JSONB NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('auto_tune', 'manual_override', 'reset')),
  success_window TEXT, -- e.g., '7d', '30d'
  metrics JSONB, -- optional performance metrics that triggered the change
  created_by UUID -- user_id for manual overrides
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_weight_audit_timestamp ON ai_weight_audit(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ai_weight_audit_reason ON ai_weight_audit(reason);

-- Comment
COMMENT ON TABLE ai_weight_audit IS 'Audit trail of AI scoring weight recalibrations';
COMMENT ON COLUMN ai_weight_audit.old_weights IS 'Previous weight configuration as JSON';
COMMENT ON COLUMN ai_weight_audit.new_weights IS 'New weight configuration after tuning';
COMMENT ON COLUMN ai_weight_audit.metrics IS 'Performance metrics snapshot (acceptance rates, etc.)';
