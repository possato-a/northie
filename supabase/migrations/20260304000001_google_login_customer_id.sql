-- Adiciona coluna para armazenar o ID da conta MCC (manager) do Google Ads.
-- Necessário para o header login-customer-id ao acessar sub-contas via MCC.
-- Para contas diretas (não-MCC), o valor permanece NULL.

ALTER TABLE integrations
    ADD COLUMN IF NOT EXISTS google_login_customer_id TEXT;

COMMENT ON COLUMN integrations.google_login_customer_id IS
    'ID da conta MCC (manager) do Google Ads. Usado como login-customer-id ao sincronizar sub-contas. NULL para contas diretas.';
