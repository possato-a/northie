-- ad_metrics.campaign_id referenciava campaigns (campanhas internas/afiliados),
-- mas deveria referenciar ad_campaigns. Como nunca foi populada (0 rows com valor),
-- removemos a coluna. Metricas de ads vivem em ad_campaigns diretamente.

ALTER TABLE ad_metrics DROP CONSTRAINT IF EXISTS ad_metrics_campaign_id_fkey;
ALTER TABLE ad_metrics DROP COLUMN IF EXISTS campaign_id;
