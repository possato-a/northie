-- Cria a tabela ad_campaigns para armazenar métricas de campanhas/adsets/ads
-- por nível hierárquico (campaign > adset > ad) com granularidade diária.

CREATE TABLE IF NOT EXISTS ad_campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    platform        TEXT NOT NULL,                          -- 'meta', 'google'
    account_id      TEXT NOT NULL DEFAULT '',
    account_name    TEXT NOT NULL DEFAULT '',
    campaign_id     TEXT NOT NULL DEFAULT '',
    campaign_name   TEXT NOT NULL DEFAULT '',
    adset_id        TEXT NOT NULL DEFAULT '',
    adset_name      TEXT NOT NULL DEFAULT '',
    ad_id           TEXT NOT NULL DEFAULT '',
    ad_name         TEXT NOT NULL DEFAULT '',
    level           TEXT NOT NULL,                          -- 'campaign', 'adset', 'ad'
    status          TEXT NOT NULL DEFAULT '',
    date            DATE NOT NULL,
    spend_brl       DECIMAL(14, 4) NOT NULL DEFAULT 0,
    impressions     INTEGER NOT NULL DEFAULT 0,
    reach           INTEGER NOT NULL DEFAULT 0,
    clicks          INTEGER NOT NULL DEFAULT 0,
    ctr             DECIMAL(10, 4) NOT NULL DEFAULT 0,
    cpc_brl         DECIMAL(14, 4) NOT NULL DEFAULT 0,
    cpm_brl         DECIMAL(14, 4) NOT NULL DEFAULT 0,
    frequency       DECIMAL(10, 4) NOT NULL DEFAULT 0,
    synced_at       TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,

    UNIQUE (profile_id, platform, level, campaign_id, adset_id, ad_id, date)
);

-- Índices para as queries mais comuns do dashboard
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_profile_date
    ON ad_campaigns (profile_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_campaign_id
    ON ad_campaigns (profile_id, campaign_id, level);
