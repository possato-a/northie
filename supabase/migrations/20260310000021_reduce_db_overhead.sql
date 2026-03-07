-- ============================================================
-- Reduce DB overhead on Micro compute (1GB RAM)
-- ============================================================

-- ── 1. Drop pg_graphql — não utilizado, consome memória ──────
-- O app usa PostgREST (REST API), não GraphQL.
DROP EXTENSION IF EXISTS pg_graphql CASCADE;

-- ── 2. Desabilitar publicação Realtime em todas as tabelas ───
-- O app não usa Supabase Realtime (só auth.onAuthStateChange).
-- A publicação supabase_realtime consome WAL sender slots e memória.
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN
        SELECT schemaname, tablename
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
    LOOP
        EXECUTE format(
            'ALTER PUBLICATION supabase_realtime DROP TABLE %I.%I',
            tbl.schemaname, tbl.tablename
        );
    END LOOP;
END;
$$;

-- ── 3. Reduzir replica identity para DEFAULT em todas ────────
-- REPLICA IDENTITY FULL (necessário pro Realtime) guarda uma cópia
-- completa de cada row antiga em cada UPDATE no WAL. Sem Realtime,
-- DEFAULT (só PK) é suficiente e muito mais leve.
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relreplident = 'f'  -- 'f' = FULL
    LOOP
        EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY DEFAULT', tbl.relname);
    END LOOP;
END;
$$;

-- ── 4. Resetar estatísticas para medir com base limpa ────────
SELECT pg_stat_reset();
