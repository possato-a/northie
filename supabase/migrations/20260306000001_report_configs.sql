CREATE TABLE IF NOT EXISTS report_configs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL DEFAULT 'monthly',
    format TEXT NOT NULL DEFAULT 'csv',
    enabled BOOLEAN DEFAULT true,
    email TEXT,
    next_send_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(profile_id)
);

CREATE TABLE IF NOT EXISTS report_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    frequency TEXT,
    format TEXT,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    status TEXT DEFAULT 'generated',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE report_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_logs ENABLE ROW LEVEL SECURITY;
