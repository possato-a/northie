-- Adiciona rastreamento de entrega de email nos logs de relatório

ALTER TABLE report_logs
  ADD COLUMN IF NOT EXISTS resend_email_id TEXT,
  ADD COLUMN IF NOT EXISTS email_status TEXT CHECK (email_status IN ('sent', 'delivered', 'bounced', 'complained', 'delayed'));

CREATE INDEX IF NOT EXISTS idx_report_logs_resend_email_id
  ON report_logs (resend_email_id)
  WHERE resend_email_id IS NOT NULL;
