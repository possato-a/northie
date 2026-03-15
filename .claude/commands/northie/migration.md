---
description: Create and run a new Supabase migration for the Northie database
model: claude-sonnet-4-6
---

Crie uma nova migration do Supabase para a Northie.

## Especificação

$ARGUMENTS

## Padrões da Northie

### Nomenclatura do arquivo
```
supabase/migrations/YYYYMMDDNNNNNN_nome_descritivo.sql
```
Use a data de hoje no formato `YYYYMMDD` + sequencial `000001`.

### Template obrigatório
```sql
-- [Descrição breve do que esta migration faz e por quê]

-- 1. Criação/alteração de tabela
CREATE TABLE IF NOT EXISTS table_name (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- colunas específicas aqui
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. RLS (obrigatório para qualquer tabela com user_id)
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own data"
  ON table_name
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. Índices essenciais
CREATE INDEX IF NOT EXISTS idx_table_name_user_id ON table_name(user_id);
CREATE INDEX IF NOT EXISTS idx_table_name_created_at ON table_name(created_at DESC);
```

### Regras
- **Nunca alterar migrations existentes** — apenas adicionar novas
- **Sempre idempotente**: usar `IF NOT EXISTS`, `IF EXISTS`
- **RLS obrigatório** em toda tabela com `user_id`
- Para colunas novas em tabela existente: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- Para índices em pgvector: `CREATE INDEX USING ivfflat (col vector_cosine_ops) WITH (lists = 100)`

### Como rodar
```bash
psql "postgresql://postgres:TSfmezl2rnS5msqJ@db.ucwlgqowqpfmotcofqoz.supabase.co:5432/postgres" \
  -f supabase/migrations/YYYYMMDDNNNNNN_nome.sql
```

## Output

1. Crie o arquivo da migration em `supabase/migrations/` com o conteúdo SQL completo
2. Explique brevemente o que a migration faz e quais tabelas/colunas afeta
3. Execute via psql usando o comando acima
4. Confirme se a execução foi bem-sucedida
