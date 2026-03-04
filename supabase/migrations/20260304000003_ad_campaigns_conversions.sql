-- Adiciona colunas de conversão e objetivo à tabela ad_campaigns.
-- Necessário para Meta Ads (purchases/leads já calculados) e Google Ads (conversions).

ALTER TABLE ad_campaigns
    ADD COLUMN IF NOT EXISTS objective         TEXT,
    ADD COLUMN IF NOT EXISTS purchases         INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS purchase_value    DECIMAL(14, 4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS leads             INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS link_clicks       INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS landing_page_views INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS video_views       INTEGER NOT NULL DEFAULT 0;
