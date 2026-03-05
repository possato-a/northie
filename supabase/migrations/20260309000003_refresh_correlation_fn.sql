-- ============================================================
-- Função para refresh das materialized views de correlação
-- Chamada via supabase.rpc() pelo correlation-refresh.job.ts
-- Requer service role key (sem RLS check)
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_correlation_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ordem importa: atribuição → performance (depende da anterior) → cohort
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_campaign_attribution;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_campaign_ltv_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cohort_retention;
END;
$$;

-- Apenas service role pode chamar esta função
REVOKE ALL ON FUNCTION refresh_correlation_views() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_correlation_views() TO service_role;
