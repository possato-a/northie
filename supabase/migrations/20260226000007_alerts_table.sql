-- Tabela de alertas automáticos gerados pelos jobs
CREATE TABLE IF NOT EXISTS alerts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    type        TEXT NOT NULL,
    severity    TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    meta        JSONB DEFAULT '{}',
    read        BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_profile_unread
    ON alerts(profile_id, read, created_at DESC);

-- RLS
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alerts: owner only" ON alerts;
CREATE POLICY "alerts: owner only" ON alerts
    FOR ALL USING (profile_id = auth.uid());
