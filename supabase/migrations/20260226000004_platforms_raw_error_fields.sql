-- Campos para controle de falhas no processamento de webhooks
ALTER TABLE platforms_data_raw
    ADD COLUMN IF NOT EXISTS error_message TEXT,
    ADD COLUMN IF NOT EXISTS failed_at     TIMESTAMP WITH TIME ZONE;

-- Índice para recovery job (buscar itens não processados e não falhos)
CREATE INDEX IF NOT EXISTS idx_raw_pending
    ON platforms_data_raw(processed, failed_at)
    WHERE processed = false AND failed_at IS NULL;
