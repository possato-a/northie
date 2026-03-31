-- ══════════════════════════════════════════════════════════════════════════════
-- Growth v2: campos extras em growth_recommendations + tabela de decisões
-- ══════════════════════════════════════════════════════════════════════════════

-- Campos adicionais em growth_recommendations
ALTER TABLE growth_recommendations
  ADD COLUMN IF NOT EXISTS result JSONB,
  ADD COLUMN IF NOT EXISTS dismissed_reason TEXT,
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

-- Tabela de memória de decisões do founder
CREATE TABLE IF NOT EXISTS growth_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('approved', 'rejected', 'instruction')),
  context TEXT NOT NULL,
  action_type TEXT,
  result_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_growth_decisions_profile ON growth_decisions(profile_id, created_at DESC);

ALTER TABLE growth_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "growth_decisions_owner" ON growth_decisions
  FOR ALL USING (profile_id = auth.uid());
