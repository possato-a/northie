-- Adiciona suporte a intervalo de datas customizado em report_configs
ALTER TABLE report_configs
    ADD COLUMN IF NOT EXISTS period_type TEXT NOT NULL DEFAULT 'last_30_days'
        CHECK (period_type IN ('last_7_days', 'last_30_days', 'last_90_days', 'custom')),
    ADD COLUMN IF NOT EXISTS custom_start DATE,
    ADD COLUMN IF NOT EXISTS custom_end DATE;

COMMENT ON COLUMN report_configs.period_type IS
    'Tipo de período do relatório: last_7_days, last_30_days, last_90_days ou custom';
COMMENT ON COLUMN report_configs.custom_start IS
    'Data inicial quando period_type = custom';
COMMENT ON COLUMN report_configs.custom_end IS
    'Data final quando period_type = custom';
