-- Adds columns needed for Hotmart ↔ Meta Ads correlation:
-- product_name and payment_method on transactions (from Hotmart API)
-- name on customers (from buyer info)

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS name TEXT;
