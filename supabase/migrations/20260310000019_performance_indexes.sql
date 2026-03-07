-- ============================================================
-- Performance Audit: Missing indexes + mat view improvements
-- ============================================================

-- ── 1. FK indexes faltantes ─────────────────────────────────
-- Sem esses indexes, JOINs, CASCADE deletes e RLS policies
-- fazem sequential scan nas tabelas inteiras.

CREATE INDEX IF NOT EXISTS idx_customers_acquisition_campaign_id
    ON customers (acquisition_campaign_id)
    WHERE acquisition_campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ad_metrics_profile_id
    ON ad_metrics (profile_id);

CREATE INDEX IF NOT EXISTS idx_commissions_campaign_id
    ON commissions (campaign_id);

CREATE INDEX IF NOT EXISTS idx_commissions_creator_id
    ON commissions (creator_id);

CREATE INDEX IF NOT EXISTS idx_commissions_transaction_id
    ON commissions (transaction_id);

CREATE INDEX IF NOT EXISTS idx_commissions_profile_id
    ON commissions (profile_id);

CREATE INDEX IF NOT EXISTS idx_affiliate_links_campaign_id
    ON affiliate_links (campaign_id);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_link_id
    ON affiliate_clicks (link_id);

CREATE INDEX IF NOT EXISTS idx_campaigns_profile_id
    ON campaigns (profile_id);

CREATE INDEX IF NOT EXISTS idx_creators_profile_id
    ON creators (profile_id);

-- ── 2. Expression index para trigger de atribuição ──────────
-- O trigger resolve_creator_attribution faz LOWER(name) na
-- tabela campaigns sem index = sequential scan em cada INSERT.

CREATE INDEX IF NOT EXISTS idx_campaigns_profile_lower_name
    ON campaigns (profile_id, LOWER(name));

-- ── 3. Unique indexes nas materialized views ────────────────
-- Necessários para REFRESH MATERIALIZED VIEW CONCURRENTLY,
-- que não bloqueia reads durante o refresh.

CREATE UNIQUE INDEX IF NOT EXISTS uidx_mv_campaign_ltv_profile_channel
    ON mv_campaign_ltv_performance (profile_id, channel);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_mv_cohort_retention_composite
    ON mv_cohort_retention (profile_id, cohort_month, acquisition_channel);

-- mv_customer_campaign_attribution já tem unique index em customer_id

-- ── 4. Refresh function com CONCURRENTLY ────────────────────
-- Agora que todas as views têm unique index, podemos usar
-- CONCURRENTLY para evitar ACCESS EXCLUSIVE lock durante refresh.

CREATE OR REPLACE FUNCTION refresh_correlation_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- CONCURRENTLY permite reads durante refresh (requer unique index)
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_campaign_attribution;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_campaign_ltv_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cohort_retention;
END;
$$;

REVOKE ALL ON FUNCTION refresh_correlation_views() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_correlation_views() TO service_role;

-- ── 5. Backfill function reescrita como set-based UPDATE ────
-- Antes: loop row-by-row com N SELECTs + N UPDATEs.
-- Agora: single UPDATE com lateral join.

CREATE OR REPLACE FUNCTION backfill_acquisition_channel_by_period()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH dominant AS (
    SELECT
      c.id AS customer_id,
      (
        SELECT
          CASE ac.platform
            WHEN 'meta'   THEN 'meta_ads'
            WHEN 'google' THEN 'google_ads'
            ELSE ac.platform
          END
        FROM ad_campaigns ac
        WHERE ac.profile_id = c.profile_id
          AND ac.date BETWEEN (c.created_at::DATE - INTERVAL '30 days') AND c.created_at::DATE
          AND ac.spend_brl > 0
        GROUP BY ac.platform
        ORDER BY SUM(ac.spend_brl) DESC
        LIMIT 1
      ) AS dominant_channel
    FROM customers c
    WHERE c.acquisition_channel = 'desconhecido'
      AND c.acquisition_campaign_id IS NULL
  )
  UPDATE customers cu
  SET acquisition_channel = d.dominant_channel::acquisition_channel
  FROM dominant d
  WHERE cu.id = d.customer_id
    AND d.dominant_channel IS NOT NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION backfill_acquisition_channel_by_period() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION backfill_acquisition_channel_by_period() TO service_role;

-- ── 6. RPC get_dashboard_stats — substitui 12 queries ───────
-- Retorna todas as métricas do dashboard em uma única query SQL.

CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_profile_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  v_now TIMESTAMPTZ := now();
  v_period_start TIMESTAMPTZ := v_now - (p_days || ' days')::INTERVAL;
  v_prev_start TIMESTAMPTZ := v_now - (p_days * 2 || ' days')::INTERVAL;
BEGIN
  SELECT json_build_object(
    'total_revenue', COALESCE(s.total_revenue, 0),
    'total_customers', COALESCE(s.total_customers, 0),
    'total_transactions', COALESCE(s.total_transactions, 0),
    'average_ticket', CASE WHEN COALESCE(s.total_transactions, 0) > 0
      THEN ROUND((s.total_revenue / s.total_transactions)::NUMERIC, 2)
      ELSE 0 END,
    'current_revenue', COALESCE(s.current_revenue, 0),
    'previous_revenue', COALESCE(s.previous_revenue, 0),
    'growth_percentage', CASE WHEN COALESCE(s.previous_revenue, 0) > 0
      THEN ROUND(((s.current_revenue - s.previous_revenue) / s.previous_revenue * 100)::NUMERIC, 2)
      ELSE NULL END
  ) INTO result
  FROM (
    SELECT
      (SELECT COALESCE(SUM(amount_net), 0) FROM transactions
       WHERE profile_id = p_profile_id AND status = 'approved') AS total_revenue,
      (SELECT COUNT(*) FROM customers
       WHERE profile_id = p_profile_id) AS total_customers,
      (SELECT COUNT(*) FROM transactions
       WHERE profile_id = p_profile_id AND status = 'approved') AS total_transactions,
      (SELECT COALESCE(SUM(amount_net), 0) FROM transactions
       WHERE profile_id = p_profile_id AND status = 'approved'
         AND created_at >= v_period_start) AS current_revenue,
      (SELECT COALESCE(SUM(amount_net), 0) FROM transactions
       WHERE profile_id = p_profile_id AND status = 'approved'
         AND created_at >= v_prev_start AND created_at < v_period_start) AS previous_revenue
  ) s;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION get_dashboard_stats(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_dashboard_stats(UUID, INTEGER) TO service_role;

-- ── 7. Index para ai_chat_history cleanup ───────────────────
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_profile_created
    ON ai_chat_history (profile_id, created_at DESC);

-- ── 8. Index para growth_recommendations dedup ──────────────
CREATE INDEX IF NOT EXISTS idx_growth_recs_profile_type_status
    ON growth_recommendations (profile_id, type, status, created_at DESC);

-- ── 9. updated_at triggers ──────────────────────────────────
-- Colunas updated_at existem mas não atualizam automaticamente.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 10. Substituir ivfflat por HNSW no embeddings ───────────
-- ivfflat exige ~1000 rows por list para ser eficiente.
-- HNSW funciona bem mesmo com poucos dados e não requer tuning.

DROP INDEX IF EXISTS idx_embeddings_vector;
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_hnsw
    ON embeddings USING hnsw (embedding vector_cosine_ops);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_customers_updated_at') THEN
    CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_integrations_updated_at') THEN
    CREATE TRIGGER trg_integrations_updated_at BEFORE UPDATE ON integrations
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_transactions_updated_at') THEN
    CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;
