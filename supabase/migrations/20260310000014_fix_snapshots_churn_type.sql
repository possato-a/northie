-- avg_churn_probability era INTEGER, mas recebe resultado de AVG() que retorna decimal.
-- Alterar para NUMERIC(5,1) para preservar 1 casa decimal.
ALTER TABLE campaign_performance_snapshots
    ALTER COLUMN avg_churn_probability TYPE NUMERIC(5,1)
    USING avg_churn_probability::NUMERIC(5,1);
