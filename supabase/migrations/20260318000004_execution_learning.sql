-- ── Execution Learning Loop — conversão pós-execução ─────────────────────────
-- Adiciona colunas de tracking de conversão em growth_execution_items e
-- cria índice otimizado para a query do loop de aprendizado diário.

-- Tracking de conversão por item de execução
ALTER TABLE growth_execution_items
  ADD COLUMN IF NOT EXISTS converted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_value numeric(12,2);

-- Status estendido para incluir delivery granular
ALTER TABLE growth_execution_items
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Índice para a query do learning loop
-- Filtra apenas itens enviados/entregues ainda não verificados para conversão
CREATE INDEX IF NOT EXISTS idx_exec_items_learning
  ON growth_execution_items(profile_id, status, created_at)
  WHERE converted = false AND status IN ('sent', 'delivered');
