-- ai_diagnostics: armazena o resultado completo do pipeline multi-agente de diagnóstico
-- Cada linha representa uma execução do diagnóstico para um profile em um período.

CREATE TABLE IF NOT EXISTS ai_diagnostics (
    id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    period_start  TIMESTAMPTZ NOT NULL,
    period_end    TIMESTAMPTZ NOT NULL,
    agent_traffic    JSONB,
    agent_conversion JSONB,
    agent_attribution JSONB,
    diagnostic    JSONB       NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- Index para buscar o diagnóstico mais recente de um profile rapidamente
CREATE INDEX IF NOT EXISTS idx_ai_diagnostics_user_created
    ON ai_diagnostics(user_id, created_at DESC);

-- RLS
ALTER TABLE ai_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_diagnostics"
    ON ai_diagnostics
    FOR ALL
    USING (auth.uid() = user_id);
