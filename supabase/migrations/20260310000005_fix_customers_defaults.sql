-- Fix defaults inconsistentes na tabela customers

-- churn_probability: tipo INTEGER, mas default era '0.00' (de quando era DECIMAL)
ALTER TABLE customers ALTER COLUMN churn_probability SET DEFAULT 0;

-- rfm_score: tipo TEXT, mas default era JSONB cast. O codigo usa formato "000" (string)
ALTER TABLE customers ALTER COLUMN rfm_score SET DEFAULT '000';
