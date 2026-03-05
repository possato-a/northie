-- Migration: workspace fields on profiles
-- Apply via: Supabase Dashboard → SQL Editor

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS business_name  TEXT,
    ADD COLUMN IF NOT EXISTS timezone       TEXT DEFAULT 'América/São Paulo (UTC-3)',
    ADD COLUMN IF NOT EXISTS currency       TEXT DEFAULT 'BRL (R$)',
    ADD COLUMN IF NOT EXISTS logo_url       TEXT;

COMMENT ON COLUMN profiles.business_name IS 'Display name of the workspace / business';
COMMENT ON COLUMN profiles.timezone      IS 'Default timezone for reports and scheduling';
COMMENT ON COLUMN profiles.currency      IS 'Default currency for reports and financial goals';
COMMENT ON COLUMN profiles.logo_url      IS 'Public URL of the workspace logo (Supabase Storage)';
