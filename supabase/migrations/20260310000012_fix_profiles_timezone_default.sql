-- Fix: timezone default invalido (nao era IANA)
-- 'America/Sao Paulo (UTC-3)' -> 'America/Sao_Paulo'
ALTER TABLE profiles ALTER COLUMN timezone SET DEFAULT 'America/Sao_Paulo';

-- Corrige registros existentes com o valor antigo
UPDATE profiles SET timezone = 'America/Sao_Paulo' WHERE timezone = 'America/Sao Paulo (UTC-3)';
