-- Campos calculados pelo job de RFM
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS rfm_updated_at TIMESTAMP WITH TIME ZONE;

-- churn_probability como inteiro (0-100)
ALTER TABLE customers
    ALTER COLUMN churn_probability TYPE INTEGER USING churn_probability::integer;

-- rfm_score como texto "RRR" ex: "543"
-- (já deve existir como TEXT, só garantindo)
ALTER TABLE customers
    ALTER COLUMN rfm_score TYPE TEXT;
