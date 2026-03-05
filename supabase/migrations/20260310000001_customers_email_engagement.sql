-- Adiciona campos de engajamento por email na tabela customers
-- email_status: rastreia bounces e reclamações para proteger reputação do domínio
-- last_engagement_at: data da última abertura/clique, útil para cálculo de churn probability

ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS email_status TEXT CHECK (email_status IN ('ok', 'bounced', 'unsubscribed')) DEFAULT 'ok',
    ADD COLUMN IF NOT EXISTS last_engagement_at TIMESTAMPTZ;

-- Índice para filtrar rapidamente clientes sem bounce ao planejar envios
CREATE INDEX IF NOT EXISTS idx_customers_email_status ON customers (profile_id, email_status)
    WHERE email_status != 'ok';
