-- ============================================================
-- DB Cleanup & Maintenance — reduzir uso de memória no Micro
-- ============================================================

-- ── 1. Limpar platforms_data_raw processados (> 30 dias) ──────
-- Essa tabela armazena JSONs brutos de webhooks. Após processamento,
-- os dados normalizados estão em transactions/customers. O raw é
-- só audit trail — não precisa ficar pra sempre.

DELETE FROM platforms_data_raw
WHERE processed = true
  AND created_at < NOW() - INTERVAL '30 days';

-- ── 2. Limpar ai_chat_history antiga (> 30 dias) ─────────────
DELETE FROM ai_chat_history
WHERE created_at < NOW() - INTERVAL '30 days';

-- ── 3. Limpar sync_logs antigos (> 30 dias) ──────────────────
DELETE FROM sync_logs
WHERE created_at < NOW() - INTERVAL '30 days';

-- ── 4. Limpar alerts lidos/dismissed (> 14 dias) ─────────────
DELETE FROM alerts
WHERE read = true
  AND created_at < NOW() - INTERVAL '14 days';

-- ── 5. Limpar growth_recommendations arquivadas (> 60 dias) ──
DELETE FROM growth_recommendations
WHERE status IN ('dismissed', 'executed')
  AND created_at < NOW() - INTERVAL '60 days';

-- ── 6. Limpar report_logs antigos (> 90 dias) ────────────────
-- Manter snapshots recentes para histórico, mas não pra sempre
DELETE FROM report_logs
WHERE created_at < NOW() - INTERVAL '90 days';

-- ── 7. Index para cleanup futuro de platforms_data_raw ────────
CREATE INDEX IF NOT EXISTS idx_platforms_data_raw_processed_created
    ON platforms_data_raw (processed, created_at)
    WHERE processed = true;

-- ── 8. Index para sync_logs cleanup ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at
    ON sync_logs (created_at);

-- ── 9. Index para alerts cleanup ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_alerts_read_created
    ON alerts (read, created_at)
    WHERE read = true;

-- ── 10. VACUUM ANALYZE — recuperar espaço e atualizar stats ──
-- Após bulk deletes, sem VACUUM o espaço não é liberado
VACUUM ANALYZE platforms_data_raw;
VACUUM ANALYZE ai_chat_history;
VACUUM ANALYZE sync_logs;
VACUUM ANALYZE alerts;
VACUUM ANALYZE growth_recommendations;
VACUUM ANALYZE report_logs;

-- ── 11. Atualizar estatísticas das tabelas principais ────────
ANALYZE customers;
ANALYZE transactions;
ANALYZE ad_metrics;
ANALYZE ad_campaigns;
ANALYZE integrations;
