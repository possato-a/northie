-- Unique constraint em transactions deve incluir platform para evitar
-- colisao de external_id entre plataformas diferentes do mesmo founder.
-- Ex: Hotmart ID "123456" vs Stripe "123456" (improvavel mas possivel)

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_profile_external_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_profile_platform_external_id
    ON transactions (profile_id, platform, external_id)
    WHERE external_id IS NOT NULL;
