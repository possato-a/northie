-- Sincroniza o default de timezone com o valor que a UI usa no Select
ALTER TABLE profiles
    ALTER COLUMN timezone SET DEFAULT 'América/São Paulo (UTC-3)';

-- Atualiza rows existentes que têm o valor antigo (america/sao_paulo sem acento)
UPDATE profiles
SET timezone = 'América/São Paulo (UTC-3)'
WHERE timezone IN ('America/Sao_Paulo', 'América/Sao_Paulo', 'America/São Paulo');
