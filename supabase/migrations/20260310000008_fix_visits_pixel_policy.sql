-- Restringe INSERT publico na visits: exige que profile_id referencie
-- um profile real (previne flood com profile_ids falsos).
-- O pixel server-side valida o profile_id antes de inserir.
-- Tambem restringe affiliate_clicks da mesma forma.

-- visits: recriar policy mais restritiva
DROP POLICY IF EXISTS "visits: pixel insert" ON visits;
CREATE POLICY "visits: pixel insert" ON visits
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = profile_id)
    );

-- affiliate_clicks: recriar com check de link valido
DROP POLICY IF EXISTS "affiliate_clicks: pixel insert" ON affiliate_clicks;
CREATE POLICY "affiliate_clicks: pixel insert" ON affiliate_clicks
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM affiliate_links WHERE id = link_id)
    );
