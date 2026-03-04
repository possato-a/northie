-- Adiciona coluna meta em sync_logs para armazenar detalhes de reconciliação
-- Usada pelo Safety Net para registrar apiCount, dbCount e gap detectado
ALTER TABLE sync_logs
    ADD COLUMN IF NOT EXISTS meta TEXT;
