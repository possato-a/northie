-- ============================================================
-- Snapshot histórico de performance por canal/campanha
-- Usado para comparar ROI e retenção ao longo dos meses
-- ============================================================

CREATE TABLE campaign_performance_snapshots (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_month        DATE        NOT NULL,          -- sempre dia 1 do mês (DATE_TRUNC)
  channel               TEXT        NOT NULL,
  campaign_name         TEXT,
  customers_acquired    INTEGER     DEFAULT 0,
  total_ltv_brl         DECIMAL(14,2) DEFAULT 0,
  avg_ltv_brl           DECIMAL(14,2) DEFAULT 0,
  total_spend_brl       DECIMAL(14,2) DEFAULT 0,
  true_roi              DECIMAL(8,4),
  retention_rate_30d    DECIMAL(5,2),
  avg_churn_probability INTEGER,
  high_churn_count      INTEGER     DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- COALESCE não pode ser usado em UNIQUE constraint — usar índice único funcional
CREATE UNIQUE INDEX ON campaign_performance_snapshots
  (profile_id, snapshot_month, channel, COALESCE(campaign_name, ''));

ALTER TABLE campaign_performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_only" ON campaign_performance_snapshots
  FOR ALL USING (auth.uid() = profile_id);

CREATE INDEX ON campaign_performance_snapshots (profile_id, snapshot_month DESC);
CREATE INDEX ON campaign_performance_snapshots (profile_id, channel);
