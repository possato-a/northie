-- ═══════════════════════════════════════════════════════════════════
-- Northie Valuation — Valuation Snapshots
-- Produto 4: Founder acompanha quanto o negócio vale, atualizado mensalmente
-- ═══════════════════════════════════════════════════════════════════

-- ── valuation_snapshots ───────────────────────────────────────────
-- Snapshot mensal do valuation calculado com base nos dados reais
-- da plataforma. Benchmark comparado com negócios similares internos.
CREATE TABLE IF NOT EXISTS valuation_snapshots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id          UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

    -- Valuation final calculado (em BRL)
    valuation_brl       DECIMAL(16, 2) NOT NULL,

    -- Metodologia usada no cálculo
    methodology         TEXT NOT NULL DEFAULT 'arr_multiple'
                            CHECK (methodology IN ('arr_multiple', 'mrr_multiple', 'ltv_multiple', 'blended')),

    -- Múltiplo aplicado sobre ARR/MRR
    multiple            DECIMAL(6, 2),

    -- Inputs do cálculo (snapshot das métricas do mês)
    arr_brl             DECIMAL(14, 2),
    mrr_brl             DECIMAL(14, 2),
    ltv_avg_brl         DECIMAL(14, 2),
    cac_avg_brl         DECIMAL(14, 2),
    ltv_cac_ratio       DECIMAL(6, 2),
    churn_rate          DECIMAL(5, 4),   -- ex: 0.0350 = 3.5%
    gross_margin        DECIMAL(5, 4),   -- ex: 0.6800 = 68%

    -- Benchmark com negócios similares dentro da plataforma Northie
    -- (anonimizado — nunca expõe dados de outros founders)
    benchmark_percentile        INTEGER CHECK (benchmark_percentile BETWEEN 0 AND 100),
    benchmark_median_brl        DECIMAL(16, 2),
    benchmark_sample_size       INTEGER,        -- quantos negócios similares existem no benchmark
    benchmark_business_type     TEXT,           -- tipo de negócio usado como base de comparação

    -- Detalhes completos do cálculo (para auditoria e PDF do Raise)
    details             JSONB DEFAULT '{}'::jsonb,

    -- Referência ao mês do snapshot (sempre dia 1 do mês)
    snapshot_month      DATE NOT NULL,

    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,

    UNIQUE (profile_id, snapshot_month)
);

CREATE INDEX IF NOT EXISTS idx_valuation_profile
    ON valuation_snapshots (profile_id, snapshot_month DESC);

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE valuation_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "valuation_snapshots: owner only" ON valuation_snapshots;
CREATE POLICY "valuation_snapshots: owner only" ON valuation_snapshots
    FOR ALL USING (profile_id = auth.uid());
