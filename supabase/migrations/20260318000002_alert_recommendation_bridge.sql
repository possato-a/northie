-- ── Alert → Growth Recommendation Bridge ─────────────────────────────────────
-- Adiciona suporte para recomendações geradas automaticamente por alertas.
--
-- Mudanças:
--   1. Expande o CHECK constraint de `type` para incluir os dois tipos novos:
--      'pausa_campanha' e 'ajuste_budget'
--   2. Adiciona colunas `auto_generated_from_alert` e `expires_at`
--   3. Cria índice de deduplicação para a query de bridge (profile + type + created_at)

-- ── 1. Expande o CHECK constraint de type ─────────────────────────────────────

ALTER TABLE growth_recommendations DROP CONSTRAINT IF EXISTS growth_recommendations_type_check;

ALTER TABLE growth_recommendations ADD CONSTRAINT growth_recommendations_type_check
    CHECK (type IN (
        'reativacao_alto_ltv',
        'pausa_campanha_ltv_baixo',
        'audience_sync_champions',
        'realocacao_budget',
        'upsell_cohort',
        'divergencia_roi_canal',
        'queda_retencao_cohort',
        'canal_alto_ltv_underinvested',
        'cac_vs_ltv_deficit',
        'em_risco_alto_valor',
        'pausa_campanha',
        'ajuste_budget'
    ));

-- ── 2. Adiciona colunas de rastreamento de origem ─────────────────────────────

ALTER TABLE growth_recommendations
    ADD COLUMN IF NOT EXISTS auto_generated_from_alert boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- ── 3. Índice para deduplicação da query do bridge ────────────────────────────
-- Acelera a verificação "já existe recomendação pendente do tipo X nas últimas 24h"

CREATE INDEX IF NOT EXISTS idx_growth_rec_type_created
    ON growth_recommendations(profile_id, type, created_at DESC)
    WHERE status = 'pending';
