-- ═══════════════════════════════════════════════════════════════════
-- Northie Raise — Data Rooms
-- Produto 3: Métricas auditadas para founders que querem captar ou vender
-- ═══════════════════════════════════════════════════════════════════

-- ── raise_rooms ───────────────────────────────────────────────────
-- Cada data room é um snapshot auditado do negócio com link de acesso
-- configurável por permissões. O Northie Score é calculado automaticamente.
CREATE TABLE IF NOT EXISTS raise_rooms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

    -- Identificação
    name            TEXT NOT NULL,
    description     TEXT,

    -- Status do data room
    status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'archived', 'expired')),

    -- Link de acesso compartilhável (token único)
    access_token    TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
    expires_at      TIMESTAMP WITH TIME ZONE,

    -- Permissões granulares — o founder decide o que cada investidor vê.
    -- Estrutura: { "faturamento": true, "ltv": true, "cac": false, ... }
    permissions     JSONB NOT NULL DEFAULT '{
        "faturamento": true,
        "mrr":         true,
        "arr":         true,
        "ltv":         true,
        "cac":         false,
        "churn":       false,
        "cohort":      false,
        "canais":      false,
        "margem":      false,
        "valuation":   false
    }'::jsonb,

    -- Northie Score (índice de saúde do negócio, 0–100)
    northie_score           INTEGER CHECK (northie_score BETWEEN 0 AND 100),
    northie_score_details   JSONB DEFAULT '{}'::jsonb,

    -- Métricas auditadas no momento de criação (snapshot)
    -- Atualizadas a cada vez que o founder refresca o data room
    metrics_snapshot        JSONB DEFAULT '{}'::jsonb,
    metrics_updated_at      TIMESTAMP WITH TIME ZONE,

    -- Agregados de visualização
    views_count             INTEGER NOT NULL DEFAULT 0,
    last_viewed_at          TIMESTAMP WITH TIME ZONE,

    created_at              TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_raise_rooms_profile
    ON raise_rooms (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_raise_rooms_token
    ON raise_rooms (access_token)
    WHERE status = 'active';

-- ── raise_room_views ──────────────────────────────────────────────
-- Log de cada acesso ao data room.
-- O founder vê quais investidores acessaram e por quanto tempo ficaram.
CREATE TABLE IF NOT EXISTS raise_room_views (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id             UUID REFERENCES raise_rooms(id) ON DELETE CASCADE NOT NULL,

    -- Fingerprint anonimizado do visitante (IP + user-agent hash, sem PII)
    viewer_fingerprint  TEXT,
    ip_hash             TEXT,
    user_agent          TEXT,

    -- Quanto tempo ficou na sessão (em segundos)
    duration_seconds    INTEGER DEFAULT 0,

    -- Quais seções foram abertas nessa sessão
    sections_viewed     JSONB DEFAULT '[]'::jsonb,

    accessed_at         TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_raise_room_views_room
    ON raise_room_views (room_id, accessed_at DESC);

-- Trigger: incrementa views_count e atualiza last_viewed_at no raise_rooms
CREATE OR REPLACE FUNCTION update_raise_room_view_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE raise_rooms
    SET
        views_count    = views_count + 1,
        last_viewed_at = NEW.accessed_at
    WHERE id = NEW.room_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_raise_room_view_stats ON raise_room_views;
CREATE TRIGGER trg_raise_room_view_stats
    AFTER INSERT ON raise_room_views
    FOR EACH ROW
    EXECUTE FUNCTION update_raise_room_view_stats();

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE raise_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "raise_rooms: owner only" ON raise_rooms;
CREATE POLICY "raise_rooms: owner only" ON raise_rooms
    FOR ALL USING (profile_id = auth.uid());

-- Investidores leem via access_token (sem autenticação Supabase)
-- O backend valida o token e usa service_role para buscar o data room.
-- Não há policy pública de SELECT aqui — acesso externo passa pelo backend.

ALTER TABLE raise_room_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "raise_room_views: owner read" ON raise_room_views;
CREATE POLICY "raise_room_views: owner read" ON raise_room_views
    FOR SELECT USING (
        room_id IN (
            SELECT id FROM raise_rooms WHERE profile_id = auth.uid()
        )
    );

-- INSERT público: o backend registra o acesso com service_role
-- O founder não insere views diretamente — só lê
