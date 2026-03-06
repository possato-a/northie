-- Coluna duplicada: transactions.acquisition_channel nunca e usada no codigo.
-- A atribuicao vive em customers.acquisition_channel (enum).
ALTER TABLE transactions DROP COLUMN IF EXISTS acquisition_channel;
