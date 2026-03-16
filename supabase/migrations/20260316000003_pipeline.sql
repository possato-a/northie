-- Pipeline leads
CREATE TABLE IF NOT EXISTS pipeline_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    source TEXT DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'lead' CHECK (status IN ('lead', 'reuniao_agendada', 'reuniao_realizada', 'fechado', 'perdido')),
    value_estimate DECIMAL(14,2),
    notes TEXT,
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_profile_status ON pipeline_leads(profile_id, status, created_at DESC);

ALTER TABLE pipeline_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pipeline_leads: owner only" ON pipeline_leads;
CREATE POLICY "pipeline_leads: owner only" ON pipeline_leads
    FOR ALL USING (profile_id = auth.uid());

-- Pipeline meetings
CREATE TABLE IF NOT EXISTS pipeline_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    lead_id UUID REFERENCES pipeline_leads(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER,
    status TEXT DEFAULT 'agendada' CHECK (status IN ('agendada', 'realizada', 'cancelada', 'no_show')),
    notes TEXT,
    transcript_summary TEXT,
    google_event_id TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pipeline_meetings_profile ON pipeline_meetings(profile_id, scheduled_at DESC);

ALTER TABLE pipeline_meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pipeline_meetings: owner only" ON pipeline_meetings;
CREATE POLICY "pipeline_meetings: owner only" ON pipeline_meetings
    FOR ALL USING (profile_id = auth.uid());

-- Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION update_pipeline_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pipeline_leads_updated_at ON pipeline_leads;
CREATE TRIGGER trg_pipeline_leads_updated_at
    BEFORE UPDATE ON pipeline_leads FOR EACH ROW EXECUTE FUNCTION update_pipeline_updated_at();

DROP TRIGGER IF EXISTS trg_pipeline_meetings_updated_at ON pipeline_meetings;
CREATE TRIGGER trg_pipeline_meetings_updated_at
    BEFORE UPDATE ON pipeline_meetings FOR EACH ROW EXECUTE FUNCTION update_pipeline_updated_at();
