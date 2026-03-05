-- ============================================================
-- Fix: Recriar materialized views de correlação com joins corretos
--
-- Problema original: mv_campaign_ltv_performance fazia JOIN
-- apenas em profile_id, multiplicando spend para cada linha.
-- Corrigido: JOIN em (profile_id, channel) usando plataforma
-- para mapear meta→meta_ads, google→google_ads.
-- ============================================================

-- Dropar em ordem reversa (cohort e performance dependem de attribution)
DROP MATERIALIZED VIEW IF EXISTS mv_cohort_retention CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_campaign_ltv_performance CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_customer_campaign_attribution CASCADE;

-- ── View 1: mv_customer_campaign_attribution ─────────────────

CREATE MATERIALIZED VIEW mv_customer_campaign_attribution AS
SELECT
  c.id                                      AS customer_id,
  c.profile_id,
  c.email,
  c.total_ltv,
  c.acquisition_channel,
  c.acquisition_campaign_id,
  cam.name                                  AS campaign_name,
  CASE
    WHEN c.acquisition_campaign_id IS NOT NULL THEN 'pixel'
    WHEN c.acquisition_channel IS NOT NULL
     AND c.acquisition_channel != 'desconhecido' THEN 'utm'
    ELSE 'unknown'
  END                                        AS attribution_confidence,
  c.last_purchase_at,
  c.rfm_score,
  c.churn_probability,
  c.created_at                              AS customer_since
FROM customers c
LEFT JOIN campaigns cam ON cam.id = c.acquisition_campaign_id;

CREATE UNIQUE INDEX ON mv_customer_campaign_attribution (customer_id);
CREATE INDEX ON mv_customer_campaign_attribution (profile_id, acquisition_channel);
CREATE INDEX ON mv_customer_campaign_attribution (profile_id, attribution_confidence);

-- ── View 2: mv_campaign_ltv_performance ──────────────────────
-- Fix: join em (profile_id, channel) via mapeamento de plataforma

CREATE MATERIALIZED VIEW mv_campaign_ltv_performance AS
WITH channel_spend AS (
  -- Agregar spend de ads por channel (meta→meta_ads, google→google_ads)
  SELECT
    profile_id,
    CASE platform
      WHEN 'meta'   THEN 'meta_ads'
      WHEN 'google' THEN 'google_ads'
      ELSE platform
    END                         AS channel,
    SUM(spend_brl)              AS total_spend_brl
  FROM ad_campaigns
  WHERE spend_brl > 0
  GROUP BY profile_id, platform
)
SELECT
  attr.profile_id,
  attr.acquisition_channel                                   AS channel,
  attr.campaign_name,
  attr.attribution_confidence,
  COUNT(DISTINCT attr.customer_id)                           AS customers_acquired,
  COALESCE(SUM(attr.total_ltv), 0)                          AS total_ltv_brl,
  COALESCE(AVG(attr.total_ltv), 0)                          AS avg_ltv_brl,
  COALESCE(cs.total_spend_brl, 0)                           AS total_spend_brl,
  CASE WHEN COALESCE(cs.total_spend_brl, 0) > 0
    THEN SUM(attr.total_ltv) / cs.total_spend_brl
    ELSE NULL
  END                                                        AS true_roi,
  COUNT(*) FILTER (WHERE attr.churn_probability >= 60)       AS high_churn_count,
  AVG(attr.churn_probability)                                AS avg_churn_probability
FROM mv_customer_campaign_attribution attr
LEFT JOIN channel_spend cs
  ON cs.profile_id = attr.profile_id
 AND cs.channel    = attr.acquisition_channel::TEXT
GROUP BY
  attr.profile_id,
  attr.acquisition_channel,
  attr.campaign_name,
  attr.attribution_confidence,
  cs.total_spend_brl;

CREATE INDEX ON mv_campaign_ltv_performance (profile_id, channel);

-- ── View 3: mv_cohort_retention ──────────────────────────────

CREATE MATERIALIZED VIEW mv_cohort_retention AS
WITH cohort_base AS (
  SELECT
    attr.profile_id,
    attr.customer_id,
    attr.acquisition_channel,
    attr.customer_since,
    DATE_TRUNC('month', attr.customer_since) AS cohort_month
  FROM mv_customer_campaign_attribution attr
),
repeat_purchases AS (
  SELECT
    cb.profile_id,
    cb.customer_id,
    cb.acquisition_channel,
    cb.cohort_month,
    cb.customer_since,
    MIN(t.created_at) FILTER (
      WHERE t.created_at > cb.customer_since + INTERVAL '1 day'
        AND t.status = 'approved'
    ) AS first_repeat_at
  FROM cohort_base cb
  LEFT JOIN transactions t
    ON t.customer_id = cb.customer_id
   AND t.profile_id  = cb.profile_id
  GROUP BY cb.profile_id, cb.customer_id, cb.acquisition_channel, cb.cohort_month, cb.customer_since
)
SELECT
  profile_id,
  acquisition_channel,
  cohort_month,
  COUNT(DISTINCT customer_id)                                                              AS cohort_size,
  COUNT(*) FILTER (WHERE first_repeat_at <= cohort_month + INTERVAL '30 days')            AS retained_30d,
  COUNT(*) FILTER (WHERE first_repeat_at <= cohort_month + INTERVAL '60 days')            AS retained_60d,
  COUNT(*) FILTER (WHERE first_repeat_at <= cohort_month + INTERVAL '90 days')            AS retained_90d,
  ROUND(
    COUNT(*) FILTER (WHERE first_repeat_at <= cohort_month + INTERVAL '30 days')::NUMERIC
    / NULLIF(COUNT(DISTINCT customer_id), 0) * 100, 1
  )                                                                                        AS retention_rate_30d
FROM repeat_purchases
GROUP BY profile_id, acquisition_channel, cohort_month;

CREATE INDEX ON mv_cohort_retention (profile_id, acquisition_channel);
CREATE INDEX ON mv_cohort_retention (profile_id, cohort_month DESC);
