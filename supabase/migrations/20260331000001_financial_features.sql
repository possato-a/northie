-- ══════════════════════════════════════════════════════════════════════════════
-- Financial Features: fixed_costs, agent_logs, agent_configs, cashflow_snapshots
-- ══════════════════════════════════════════════════════════════════════════════

-- Categorias de gastos
DO $$ BEGIN
  CREATE TYPE expense_category AS ENUM (
    'ads', 'saas', 'agencia', 'freelancer', 'plataforma', 'pessoal', 'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Gastos fixos mensais cadastrados pelo founder ─────────────────────────────
CREATE TABLE IF NOT EXISTS fixed_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  supplier_name TEXT,
  category expense_category DEFAULT 'outro',
  monthly_cost_brl NUMERIC(12,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Log de atividade dos agentes financeiros ──────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('receita', 'caixa', 'gastos', 'oportunidade')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'atencao', 'critico')),
  title TEXT NOT NULL,
  description TEXT,
  suggestion TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'resolvido', 'ignorado')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Configurações dos agentes por founder ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  agent_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  thresholds JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, agent_type)
);

-- ── Snapshots de caixa para histórico e comparação ────────────────────────────
CREATE TABLE IF NOT EXISTS cashflow_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  snapshot_date DATE NOT NULL,
  caixa_estimado_brl NUMERIC(12,2),
  forecast_30d_base NUMERIC(12,2),
  forecast_30d_otimista NUMERIC(12,2),
  forecast_30d_pessimista NUMERIC(12,2),
  forecast_60d_base NUMERIC(12,2),
  runway_meses NUMERIC(5,1),
  custos_fixos_mensais NUMERIC(12,2),
  media_ads_spend_mensal NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, snapshot_date)
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_agent_logs_profile ON agent_logs(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_status ON agent_logs(profile_id, status) WHERE status = 'aberto';
CREATE INDEX IF NOT EXISTS idx_fixed_costs_profile ON fixed_costs(profile_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cashflow_profile ON cashflow_snapshots(profile_id, snapshot_date DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fixed_costs_owner" ON fixed_costs
  FOR ALL USING (profile_id = auth.uid());

CREATE POLICY "agent_logs_owner" ON agent_logs
  FOR ALL USING (profile_id = auth.uid());

CREATE POLICY "agent_configs_owner" ON agent_configs
  FOR ALL USING (profile_id = auth.uid());

CREATE POLICY "cashflow_snapshots_owner" ON cashflow_snapshots
  FOR ALL USING (profile_id = auth.uid());
