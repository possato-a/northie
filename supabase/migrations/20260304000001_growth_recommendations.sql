-- ── growth_recommendations ────────────────────────────────────────────────────
-- Motor de crescimento: armazena recomendações geradas pelo job de correlações.
-- Cada recomendação cruza pelo menos 2 fontes de dados e requer aprovação
-- explícita do founder antes de qualquer execução automática.

CREATE TABLE IF NOT EXISTS growth_recommendations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    type            TEXT NOT NULL CHECK (type IN (
                        'reativacao_alto_ltv',
                        'pausa_campanha_ltv_baixo',
                        'audience_sync_champions',
                        'realocacao_budget',
                        'upsell_cohort'
                    )),
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                        'pending',
                        'approved',
                        'executing',
                        'completed',
                        'failed',
                        'dismissed'
                    )),
    title           TEXT NOT NULL,
    narrative       TEXT NOT NULL,
    impact_estimate TEXT,
    sources         TEXT[] NOT NULL DEFAULT '{}',
    execution_log   JSONB DEFAULT '[]'::jsonb,
    meta            JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Índice para queries de listagem (pendentes + recentes por profile)
CREATE INDEX IF NOT EXISTS idx_growth_recs_profile_status
    ON growth_recommendations (profile_id, status, created_at DESC);

-- RLS: founder só vê as próprias recomendações
ALTER TABLE growth_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "growth_recommendations: owner only" ON growth_recommendations;
CREATE POLICY "growth_recommendations: owner only" ON growth_recommendations
    FOR ALL USING (profile_id = auth.uid());

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_growth_recommendations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_growth_recs_updated_at ON growth_recommendations;
CREATE TRIGGER trg_growth_recs_updated_at
    BEFORE UPDATE ON growth_recommendations
    FOR EACH ROW EXECUTE FUNCTION update_growth_recommendations_updated_at();
