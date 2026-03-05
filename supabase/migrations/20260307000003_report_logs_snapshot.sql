-- Adiciona snapshot de métricas e situação geral ao log de relatório
ALTER TABLE report_logs
  ADD COLUMN IF NOT EXISTS snapshot JSONB,
  ADD COLUMN IF NOT EXISTS situacao_geral TEXT CHECK (situacao_geral IN ('saudavel','atencao','critica'));
