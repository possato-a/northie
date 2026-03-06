-- Adiciona campo triggered_by em report_logs para distinguir origem do relatório
ALTER TABLE report_logs
    ADD COLUMN IF NOT EXISTS triggered_by TEXT NOT NULL DEFAULT 'manual'
    CHECK (triggered_by IN ('manual', 'automatic', 'email'));

COMMENT ON COLUMN report_logs.triggered_by IS
    'Como o relatório foi gerado: manual (download direto), email (envio manual), automatic (cron automático)';
