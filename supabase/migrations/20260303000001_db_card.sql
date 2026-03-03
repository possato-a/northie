-- ═══════════════════════════════════════════════════════════════════
-- Northie Card — Capital Score History & Card Applications
-- Produto 2: Cartão corporativo com limite baseado no faturamento real
-- ═══════════════════════════════════════════════════════════════════

-- ── capital_score_history ─────────────────────────────────────────
-- Snapshot mensal do Capital Score por founder.
-- O score é calculado a partir de 4 dimensões: consistência de receita,
-- qualidade da base (LTV médio + churn), eficiência de aquisição
-- (CAC/LTV ratio) e histórico de uso da plataforma.
CREATE TABLE IF NOT EXISTS capital_score_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id          UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

    -- Score consolidado (0–100)
    score               INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),

    -- Dimensões do cálculo (0–25 cada, somam 100)
    score_revenue       INTEGER NOT NULL DEFAULT 0 CHECK (score_revenue BETWEEN 0 AND 25),
    score_ltv_churn     INTEGER NOT NULL DEFAULT 0 CHECK (score_ltv_churn BETWEEN 0 AND 25),
    score_cac_ltv       INTEGER NOT NULL DEFAULT 0 CHECK (score_cac_ltv BETWEEN 0 AND 25),
    score_platform_age  INTEGER NOT NULL DEFAULT 0 CHECK (score_platform_age BETWEEN 0 AND 25),

    -- Inputs do cálculo (snapshot das métricas do mês)
    mrr_brl             DECIMAL(14, 2),
    ltv_avg_brl         DECIMAL(14, 2),
    churn_rate          DECIMAL(5, 4),   -- ex: 0.0350 = 3.5%
    cac_ltv_ratio       DECIMAL(5, 4),   -- ex: 0.2500 = CAC é 25% do LTV
    months_on_platform  INTEGER,

    -- Limite calculado com base no score
    credit_limit_brl    DECIMAL(14, 2),

    -- Detalhes completos do cálculo (para auditoria e explicabilidade)
    details             JSONB DEFAULT '{}'::jsonb,

    -- Referência ao mês do snapshot (sempre dia 1 do mês)
    snapshot_month      DATE NOT NULL,

    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,

    UNIQUE (profile_id, snapshot_month)
);

CREATE INDEX IF NOT EXISTS idx_capital_score_profile
    ON capital_score_history (profile_id, snapshot_month DESC);

-- ── card_applications ─────────────────────────────────────────────
-- Lista de espera e aplicações para o Northie Card.
-- Um founder pode estar na waitlist antes de ser aprovado.
CREATE TABLE IF NOT EXISTS card_applications (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id              UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

    -- Status da aplicação
    status                  TEXT NOT NULL DEFAULT 'waitlist'
                                CHECK (status IN ('waitlist', 'pending_review', 'approved', 'rejected', 'active', 'cancelled')),

    -- Score no momento da aplicação (referência histórica)
    capital_score_snapshot  INTEGER,

    -- Limites
    requested_limit_brl     DECIMAL(14, 2),
    approved_limit_brl      DECIMAL(14, 2),
    used_limit_brl          DECIMAL(14, 2) DEFAULT 0,

    -- Split automático configurado (percentual da receita para amortização)
    split_rate              DECIMAL(5, 4),  -- ex: 0.1500 = 15%

    -- Metadados do processo
    notes                   TEXT,
    reviewed_by             TEXT,           -- identificador do analista interno (se houver)
    reviewed_at             TIMESTAMP WITH TIME ZONE,
    activated_at            TIMESTAMP WITH TIME ZONE,

    created_at              TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,

    -- Apenas uma aplicação ativa por founder
    UNIQUE (profile_id)
);

CREATE INDEX IF NOT EXISTS idx_card_applications_status
    ON card_applications (status, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE capital_score_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "capital_score_history: owner only" ON capital_score_history;
CREATE POLICY "capital_score_history: owner only" ON capital_score_history
    FOR ALL USING (profile_id = auth.uid());

ALTER TABLE card_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "card_applications: owner only" ON card_applications;
CREATE POLICY "card_applications: owner only" ON card_applications
    FOR ALL USING (profile_id = auth.uid());
