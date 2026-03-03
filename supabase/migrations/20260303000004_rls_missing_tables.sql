-- ═══════════════════════════════════════════════════════════════════
-- RLS — Tabelas sem policy após migration inicial
-- Corrige lacunas de segurança nas tabelas criadas após o rls_policies.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── ad_campaigns ──────────────────────────────────────────────────
-- Criada em 20260226000008, sem RLS aplicado
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_campaigns: owner only" ON ad_campaigns;
CREATE POLICY "ad_campaigns: owner only" ON ad_campaigns
    FOR ALL USING (profile_id = auth.uid());

-- ── affiliate_links ───────────────────────────────────────────────
-- Criada no schema inicial, ausente no rls_policies.sql
-- Acesso indireto via campaign_id -> campaigns.profile_id
ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "affiliate_links: owner only" ON affiliate_links;
CREATE POLICY "affiliate_links: owner only" ON affiliate_links
    FOR ALL USING (
        campaign_id IN (
            SELECT id FROM campaigns WHERE profile_id = auth.uid()
        )
    );

-- INSERT público para o pixel (sem autenticação — visitantes criam cliques)
DROP POLICY IF EXISTS "affiliate_clicks: pixel insert" ON affiliate_links;

-- ── affiliate_clicks ──────────────────────────────────────────────
-- Criada no schema inicial, ausente no rls_policies.sql
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "affiliate_clicks: owner read" ON affiliate_clicks;
CREATE POLICY "affiliate_clicks: owner read" ON affiliate_clicks
    FOR SELECT USING (
        link_id IN (
            SELECT al.id
            FROM affiliate_links al
            JOIN campaigns c ON c.id = al.campaign_id
            WHERE c.profile_id = auth.uid()
        )
    );

-- INSERT público: o pixel registra cliques sem autenticação
DROP POLICY IF EXISTS "affiliate_clicks: pixel insert" ON affiliate_clicks;
CREATE POLICY "affiliate_clicks: pixel insert" ON affiliate_clicks
    FOR INSERT WITH CHECK (true);

-- ── embeddings ────────────────────────────────────────────────────
-- Criada em ai_setup.sql, sem RLS
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "embeddings: owner only" ON embeddings;
CREATE POLICY "embeddings: owner only" ON embeddings
    FOR ALL USING (profile_id = auth.uid());
