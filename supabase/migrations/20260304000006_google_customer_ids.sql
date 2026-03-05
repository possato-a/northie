-- Adiciona coluna google_customer_ids na tabela integrations
-- Necessária para o sync do Google Ads identificar quais contas sincronizar

ALTER TABLE integrations
    ADD COLUMN IF NOT EXISTS google_customer_ids TEXT[] DEFAULT '{}';
