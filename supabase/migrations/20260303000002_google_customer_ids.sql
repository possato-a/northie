-- Adiciona coluna google_customer_ids na tabela integrations
-- Necessário para o sync do Google Ads saber quais contas sincronizar.
-- Populada automaticamente via listAccessibleCustomers após o OAuth.

ALTER TABLE integrations
    ADD COLUMN IF NOT EXISTS google_customer_ids TEXT[] DEFAULT '{}';
