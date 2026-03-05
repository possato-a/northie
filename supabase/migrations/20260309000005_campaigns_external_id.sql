-- ============================================================
-- Bridge entre ad_campaigns (IDs externos TEXT da Meta/Google)
-- e customers.acquisition_campaign_id (UUID interno)
--
-- Problema: ad_campaigns.campaign_id é TEXT (ex: "6084142...")
-- Campaigns.id é UUID — impossível fazer JOIN direto.
--
-- Solução: adicionar external_id TEXT à tabela campaigns
-- para armazenar o ID da plataforma de ads, criando o bridge.
-- ============================================================

-- Adiciona external_id à tabela campaigns para guardar IDs de plataformas externas
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_platform TEXT;  -- 'meta' | 'google' | etc

CREATE INDEX IF NOT EXISTS idx_campaigns_external_id
  ON campaigns (profile_id, external_id)
  WHERE external_id IS NOT NULL;

-- ── Função: resolver acquisition_channel por período de atividade ──
-- Para clientes sem atribuição direta (acquisition_channel='desconhecido'),
-- usa heurística de período: se Meta Ads estava ativo quando o cliente comprou,
-- atribui ao canal de maior gasto naquele período (melhor do que 'desconhecido').
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
  -- Para cada customer sem atribuição clara
  FOR rec IN
    SELECT c.id, c.profile_id, c.created_at::DATE AS purchase_date
    FROM customers c
    WHERE c.acquisition_channel = 'desconhecido'
      AND c.acquisition_campaign_id IS NULL
  LOOP
    -- Janela de 30 dias antes da compra (período de influência do anúncio)
    period_start := rec.purchase_date - INTERVAL '30 days';
    period_end   := rec.purchase_date;

    -- Canal com maior gasto no período (proxy de atribuição)
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

    -- Só atualiza se encontrou anúncios ativos no período
    IF dominant_channel IS NOT NULL THEN
      UPDATE customers
        SET acquisition_channel = dominant_channel
      WHERE id = rec.id;
      updated_count := updated_count + 1;
    END IF;
  END LOOP;

  RETURN updated_count;
END;
$$;

-- Grants para service_role (chamado pelo backend)
REVOKE ALL ON FUNCTION backfill_acquisition_channel_by_period() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION backfill_acquisition_channel_by_period() TO service_role;

COMMENT ON FUNCTION backfill_acquisition_channel_by_period() IS
  'Atribui acquisition_channel a clientes "desconhecido" com base no canal de maior gasto de ads no período de 30 dias antes da primeira compra. Heurística de atribuição temporal — não determinística.';
