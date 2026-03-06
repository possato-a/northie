-- Indice para queries de periodo no dashboard e relatorios
CREATE INDEX IF NOT EXISTS idx_transactions_created_at
    ON transactions (profile_id, created_at DESC);
