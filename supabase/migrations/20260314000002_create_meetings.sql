-- Tabela de reuniões do Google Calendar/Meet com análise de IA

CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  title text,
  attendees jsonb DEFAULT '[]',          -- [{ email, name, organizer }]
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes integer,
  meet_link text,
  transcript text,                       -- transcrição bruta (quando disponível)
  ai_summary text,                       -- resumo gerado pela IA
  ai_objections jsonb DEFAULT '[]',      -- ["objeção de preço", "dúvida sobre implementação"]
  ai_result text,                        -- positive | neutral | negative
  ai_cycle_signal text,                  -- análise do ciclo de decisão
  ai_tags jsonb DEFAULT '[]',            -- tags extraídas pela IA
  linked_customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  linked_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, google_event_id)
);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meetings_own"
  ON meetings FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE INDEX idx_meetings_profile_id ON meetings(profile_id, started_at DESC);
CREATE INDEX idx_meetings_linked_transaction ON meetings(linked_transaction_id) WHERE linked_transaction_id IS NOT NULL;
CREATE INDEX idx_meetings_linked_customer ON meetings(linked_customer_id) WHERE linked_customer_id IS NOT NULL;
