-- Campos para tracking de subscription lifecycle (MRR/churn via Stripe webhooks)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS churned_at TIMESTAMPTZ;
