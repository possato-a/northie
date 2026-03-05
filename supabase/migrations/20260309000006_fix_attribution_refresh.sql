-- ============================================================
-- Fix 1: Backfill function — cast TEXT → acquisition_channel ENUM
-- Fix 2: Refresh function — usar REFRESH normal (não CONCURRENTLY)
--        CONCURRENTLY exige UNIQUE index em todas as views,
--        que não é viável por causa de NULLs em campaign_name.
-- ============================================================

-- Fix 1: Corrigir função de backfill com cast de ENUM
CREATE OR REPLACE FUNCTION backfill_acquisition_channel_by_period()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER := 0;
  rec RECORD;
  dominant_channel TEXT;
  period_start DATE;
  period_end DATE;
BEGIN
  FOR rec IN
    SELECT c.id, c.profile_id, c.created_at::DATE AS purchase_date
    FROM customers c
    WHERE c.acquisition_channel = 'desconhecido'
      AND c.acquisition_campaign_id IS NULL
  LOOP
    period_start := rec.purchase_date - INTERVAL '30 days';
    period_end   := rec.purchase_date;

    SELECT
      CASE platform
        WHEN 'meta'   THEN 'meta_ads'
        WHEN 'google' THEN 'google_ads'
        ELSE platform
      END
    INTO dominant_channel
    FROM ad_campaigns
    WHERE profile_id = rec.profile_id
      AND date BETWEEN period_start AND period_end
      AND spend_brl > 0
    GROUP BY platform
    ORDER BY SUM(spend_brl) DESC
    LIMIT 1;

    IF dominant_channel IS NOT NULL THEN
      -- Cast explícito TEXT → acquisition_channel ENUM
      EXECUTE format(
        'UPDATE customers SET acquisition_channel = %L::acquisition_channel WHERE id = %L',
        dominant_channel, rec.id
      );
      updated_count := updated_count + 1;
    END IF;
  END LOOP;

  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION backfill_acquisition_channel_by_period() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION backfill_acquisition_channel_by_period() TO service_role;

-- Fix 2: Refresh sem CONCURRENTLY (lock mais curto que DROP/CREATE, seguro em prod)
CREATE OR REPLACE FUNCTION refresh_correlation_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_customer_campaign_attribution;
  REFRESH MATERIALIZED VIEW mv_campaign_ltv_performance;
  REFRESH MATERIALIZED VIEW mv_cohort_retention;
END;
$$;

REVOKE ALL ON FUNCTION refresh_correlation_views() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_correlation_views() TO service_role;
