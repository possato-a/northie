-- ============================================================
-- Fix autovacuum for small tables
-- ============================================================
-- O threshold padrão do autovacuum é 50 + 20% das live rows.
-- Para tabelas com <50 rows, o threshold nunca é atingido e
-- dead tuples acumulam indefinidamente.

-- Tabelas de negócio (crescem devagar)
ALTER TABLE customers SET (autovacuum_vacuum_threshold = 5, autovacuum_vacuum_scale_factor = 0.1, autovacuum_analyze_threshold = 5, autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE transactions SET (autovacuum_vacuum_threshold = 5, autovacuum_vacuum_scale_factor = 0.1, autovacuum_analyze_threshold = 5, autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE integrations SET (autovacuum_vacuum_threshold = 5, autovacuum_vacuum_scale_factor = 0.1, autovacuum_analyze_threshold = 5, autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE profiles SET (autovacuum_vacuum_threshold = 2, autovacuum_vacuum_scale_factor = 0.1, autovacuum_analyze_threshold = 2, autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE ad_metrics SET (autovacuum_vacuum_threshold = 10, autovacuum_vacuum_scale_factor = 0.1, autovacuum_analyze_threshold = 10, autovacuum_analyze_scale_factor = 0.05);

-- Tabelas de log/operacional
ALTER TABLE ai_chat_history SET (autovacuum_vacuum_threshold = 10, autovacuum_vacuum_scale_factor = 0.1, autovacuum_analyze_threshold = 10, autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE sync_logs SET (autovacuum_vacuum_threshold = 10, autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE alerts SET (autovacuum_vacuum_threshold = 5, autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE visits SET (autovacuum_vacuum_threshold = 5, autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE growth_recommendations SET (autovacuum_vacuum_threshold = 5, autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE report_configs SET (autovacuum_vacuum_threshold = 2, autovacuum_vacuum_scale_factor = 0.1);
