-- Expande o CHECK constraint de growth_recommendations para incluir os 5 tipos
-- adicionados pelo motor de correlações (detectores 6-10) que antes falhavam silenciosamente.

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
        'em_risco_alto_valor'
    ));
