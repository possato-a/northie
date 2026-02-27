-- Tabela de log de sincronizações de ads
-- Registra cada execução de sync: quando rodou, quantos registros, se houve erro.
CREATE TABLE IF NOT EXISTS sync_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    platform    TEXT NOT NULL,               -- 'meta', 'google'
    started_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE,
    status      TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'error'
    rows_upserted INTEGER DEFAULT 0,
    error_message TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_profile_platform
    ON sync_logs (profile_id, platform, started_at DESC);

-- Coluna de mutex para evitar syncs paralelos na mesma integração
ALTER TABLE integrations
    ADD COLUMN IF NOT EXISTS is_syncing BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS sync_started_at TIMESTAMP WITH TIME ZONE;

-- RLS: só o service role pode ler/escrever sync_logs (backend-only)
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_sync_logs" ON sync_logs
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
