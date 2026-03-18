-- Análise IA de transcrições de reuniões e contexto de meeting no customer

-- Adiciona campo de análise estruturada gerada pela IA (se não existir)
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb;

-- Adiciona contexto de reunião ao customer para enriquecimento transacional
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS meeting_context jsonb;

-- Índice para buscar reuniões com transcript não processado eficientemente
CREATE INDEX IF NOT EXISTS idx_meetings_needs_analysis
  ON meetings(profile_id)
  WHERE transcript IS NOT NULL AND ai_analysis IS NULL;
