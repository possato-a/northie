-- Adiciona policy de leitura para usuarios autenticados em sync_logs
-- (a policy existente so permite service_role)
DROP POLICY IF EXISTS "sync_logs: owner read" ON sync_logs;
CREATE POLICY "sync_logs: owner read" ON sync_logs
    FOR SELECT USING (profile_id = auth.uid());
