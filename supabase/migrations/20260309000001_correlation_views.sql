-- ============================================================
-- Camada de Atribuição e Performance — Northie Growth Engine
-- Materialized views para correlação campanha × cliente × LTV
-- ============================================================

-- ── View 1: mv_customer_campaign_attribution ─────────────────
-- "Qual campanha adquiriu qual customer, com que confiança?"

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
    WHEN c.acquisition_channel != 'desconhecido' THEN 'utm'
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
-- "Para cada canal/campanha: quantos clientes, LTV real, spend, ROI verdadeiro?"

CREATE MATERIALIZED VIEW mv_campaign_ltv_performance AS
SELECT
  attr.profile_id,
  attr.acquisition_channel                                   AS channel,
  attr.campaign_name,
  attr.attribution_confidence,
  COUNT(DISTINCT attr.customer_id)                           AS customers_acquired,
  SUM(attr.total_ltv)                                        AS total_ltv_brl,
  AVG(attr.total_ltv)                                        AS avg_ltv_brl,
  COALESCE(ads.total_spend_brl, 0)                           AS total_spend_brl,
  CASE WHEN COALESCE(ads.total_spend_brl, 0) > 0
    THEN SUM(attr.total_ltv) / ads.total_spend_brl
    ELSE NULL
  END                                                        AS true_roi,
  COUNT(*) FILTER (WHERE attr.churn_probability >= 60)       AS high_churn_count,
  AVG(attr.churn_probability)                                AS avg_churn_probability
FROM mv_customer_campaign_attribution attr
LEFT JOIN (
  SELECT profile_id, account_name, SUM(spend_brl) AS total_spend_brl
  FROM ad_campaigns
  GROUP BY profile_id, account_name
) ads ON ads.profile_id = attr.profile_id
GROUP BY
  attr.profile_id,
  attr.acquisition_channel,
  attr.campaign_name,
  attr.attribution_confidence,
  ads.total_spend_brl;

CREATE INDEX ON mv_campaign_ltv_performance (profile_id, channel);

-- ── View 3: mv_cohort_retention ──────────────────────────────
-- "Clientes adquiridos num mês/canal: quantos voltaram em 30/60/90d?"

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
