-- Phase 21: AI Feedback Capture Table
-- Stores post-assignment outcomes for performance learning

CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  shift_id UUID NOT NULL,
  assignment_id UUID,
  result TEXT NOT NULL CHECK (result IN ('success', 'fail')),
  reason TEXT,
  responded_in INTEGER, -- response time in seconds
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_feedback_agent_id ON ai_feedback(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_shift_id ON ai_feedback(shift_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created_at ON ai_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_result ON ai_feedback(result);

-- Comment
COMMENT ON TABLE ai_feedback IS 'AI assignment outcome feedback for model learning and weight tuning';
COMMENT ON COLUMN ai_feedback.result IS 'success = accepted and completed, fail = declined or cancelled';
COMMENT ON COLUMN ai_feedback.responded_in IS 'Response time in seconds from assignment to acceptance/decline';
