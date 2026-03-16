-- Business Context: founder-supplied context that trains the AI
-- One row per profile (UNIQUE on profile_id).

CREATE TABLE IF NOT EXISTS business_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    segmento TEXT,
    icp TEXT,
    ticket_medio DECIMAL(14,2),
    ciclo_vendas TEXT,
    sazonalidades TEXT,
    instrucoes_ia TEXT,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_business_context_profile ON business_context(profile_id);

ALTER TABLE business_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_context: owner only" ON business_context;
CREATE POLICY "business_context: owner only" ON business_context
    FOR ALL USING (profile_id = auth.uid());

CREATE OR REPLACE FUNCTION update_business_context_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_business_context_updated_at ON business_context;
CREATE TRIGGER trg_business_context_updated_at
    BEFORE UPDATE ON business_context
    FOR EACH ROW EXECUTE FUNCTION update_business_context_updated_at();
