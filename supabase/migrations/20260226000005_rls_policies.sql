-- ═══════════════════════════════════════════════════════════════════
-- Row Level Security (RLS) — Northie
-- Usa auth.uid() diretamente (sem função auxiliar) para máxima
-- compatibilidade com o SQL Editor do Supabase.
-- ═══════════════════════════════════════════════════════════════════

-- ── profiles ──────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles: owner only" ON profiles;
CREATE POLICY "profiles: owner only" ON profiles
    FOR ALL USING (id = auth.uid());

-- ── transactions ──────────────────────────────────────────────────
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions: owner only" ON transactions;
CREATE POLICY "transactions: owner only" ON transactions
    FOR ALL USING (profile_id = auth.uid());

-- ── customers ─────────────────────────────────────────────────────
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers: owner only" ON customers;
CREATE POLICY "customers: owner only" ON customers
    FOR ALL USING (profile_id = auth.uid());

-- ── integrations ──────────────────────────────────────────────────
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integrations: owner only" ON integrations;
CREATE POLICY "integrations: owner only" ON integrations
    FOR ALL USING (profile_id = auth.uid());

-- ── ad_metrics ────────────────────────────────────────────────────
ALTER TABLE ad_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_metrics: owner only" ON ad_metrics;
CREATE POLICY "ad_metrics: owner only" ON ad_metrics
    FOR ALL USING (profile_id = auth.uid());

-- ── platforms_data_raw ────────────────────────────────────────────
ALTER TABLE platforms_data_raw ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "raw: owner only" ON platforms_data_raw;
CREATE POLICY "raw: owner only" ON platforms_data_raw
    FOR ALL USING (profile_id = auth.uid());

-- ── campaigns ─────────────────────────────────────────────────────
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns: owner only" ON campaigns;
CREATE POLICY "campaigns: owner only" ON campaigns
    FOR ALL USING (profile_id = auth.uid());

-- ── creators ──────────────────────────────────────────────────────
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creators: owner only" ON creators;
CREATE POLICY "creators: owner only" ON creators
    FOR ALL USING (profile_id = auth.uid());

-- ── commissions ───────────────────────────────────────────────────
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commissions: owner only" ON commissions;
CREATE POLICY "commissions: owner only" ON commissions
    FOR ALL USING (profile_id = auth.uid());

-- ── campaign_creators ─────────────────────────────────────────────
ALTER TABLE campaign_creators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaign_creators: owner only" ON campaign_creators;
CREATE POLICY "campaign_creators: owner only" ON campaign_creators
    FOR ALL USING (
        campaign_id IN (
            SELECT id FROM campaigns WHERE profile_id = auth.uid()
        )
    );

-- ── visits ────────────────────────────────────────────────────────
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visits: owner only" ON visits;
CREATE POLICY "visits: owner only" ON visits
    FOR ALL USING (profile_id = auth.uid());

-- INSERT público para o pixel (sem autenticação)
DROP POLICY IF EXISTS "visits: pixel insert" ON visits;
CREATE POLICY "visits: pixel insert" ON visits
    FOR INSERT WITH CHECK (true);
