-- Adiciona coluna plaintext para lookup rápido de Stripe account ID nos webhooks.
-- Evita decriptar config_encrypted de todas as integrações a cada webhook recebido.
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;

CREATE INDEX IF NOT EXISTS idx_integrations_stripe_account_id
    ON integrations (stripe_account_id)
    WHERE stripe_account_id IS NOT NULL;
