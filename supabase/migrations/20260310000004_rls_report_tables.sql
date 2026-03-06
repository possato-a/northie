-- RLS policies para report_configs e report_logs
-- Essas tabelas tinham RLS habilitado mas sem policies criadas,
-- o que as tornava inacessiveis via Supabase client (frontend).

-- report_configs: cada founder ve/edita apenas a sua config
DROP POLICY IF EXISTS "report_configs: owner only" ON report_configs;
CREATE POLICY "report_configs: owner only" ON report_configs
    FOR ALL USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

-- report_logs: cada founder ve apenas seus logs
DROP POLICY IF EXISTS "report_logs: owner only" ON report_logs;
CREATE POLICY "report_logs: owner only" ON report_logs
    FOR ALL USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());
