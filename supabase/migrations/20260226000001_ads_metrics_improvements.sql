-- Adiciona colunas de rastreamento por conta de anúncio
ALTER TABLE ad_metrics
    ADD COLUMN IF NOT EXISTS account_id   TEXT,
    ADD COLUMN IF NOT EXISTS account_name TEXT,
    ADD COLUMN IF NOT EXISTS synced_at    TIMESTAMP WITH TIME ZONE;

-- Garante constraint única para upsert por conta/dia/plataforma
-- (remove antiga se existir, recria correta)
ALTER TABLE ad_metrics DROP CONSTRAINT IF EXISTS ad_metrics_profile_platform_date_key;
ALTER TABLE ad_metrics DROP CONSTRAINT IF EXISTS ad_metrics_profile_platform_date_account_key;

ALTER TABLE ad_metrics
    ADD CONSTRAINT ad_metrics_profile_platform_date_account_key
    UNIQUE (profile_id, platform, date, account_id);
