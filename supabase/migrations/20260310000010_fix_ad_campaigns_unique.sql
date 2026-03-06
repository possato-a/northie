-- Fix: unique constraint em ad_campaigns usa COALESCE para tratar NULL como ''
-- Previne duplicatas quando adset_id ou ad_id vem como NULL em vez de ''

ALTER TABLE ad_campaigns DROP CONSTRAINT IF EXISTS ad_campaigns_profile_id_platform_level_campaign_id_adset_id_key;

CREATE UNIQUE INDEX idx_ad_campaigns_composite_unique
    ON ad_campaigns (
        profile_id,
        platform,
        level,
        campaign_id,
        COALESCE(adset_id, ''),
        COALESCE(ad_id, ''),
        date
    );
