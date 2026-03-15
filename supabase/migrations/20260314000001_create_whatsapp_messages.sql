-- Tabela de mensagens WhatsApp enviadas pelo Growth Engine e sistema de alertas

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_number text NOT NULL,
  template_name text,
  content text,
  wamid text,                    -- WhatsApp message ID retornado pela API
  status text DEFAULT 'sent',   -- sent | delivered | read | failed
  growth_action_id uuid,         -- FK opcional para a ação do Growth que gerou isso
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_messages_own"
  ON whatsapp_messages FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE INDEX idx_whatsapp_messages_profile_id ON whatsapp_messages(profile_id, created_at DESC);
CREATE INDEX idx_whatsapp_messages_wamid ON whatsapp_messages(wamid) WHERE wamid IS NOT NULL;
