-- ── Growth Execution System — Sprint 1 ──────────────────────────────────────
-- Cria as tabelas necessárias para o sistema de execução do Growth Engine:
--   • growth_collaboration_sessions  — sessões de co-elaboração de mensagens com IA
--   • growth_execution_items         — itens de execução retomáveis por recomendação
--   • email_campaigns                — log de emails enviados pelo Growth Engine
-- Adapta tabelas existentes:
--   • whatsapp_messages              — adiciona colunas ausentes e mantém compatibilidade
--   • growth_recommendations         — expande status e adiciona colunas de execução

-- ── 1. growth_collaboration_sessions ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS growth_collaboration_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID REFERENCES growth_recommendations(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  agent_type TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  segment_snapshot JSONB DEFAULT '[]'::jsonb,
  draft_message TEXT,
  draft_params JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'confirmed', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_collab_sessions_recommendation
  ON growth_collaboration_sessions(recommendation_id);

CREATE INDEX IF NOT EXISTS idx_collab_sessions_profile
  ON growth_collaboration_sessions(profile_id, created_at DESC);

ALTER TABLE growth_collaboration_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collab_sessions: owner only" ON growth_collaboration_sessions;
CREATE POLICY "collab_sessions: owner only" ON growth_collaboration_sessions
  FOR ALL USING (profile_id = auth.uid());

-- ── 2. growth_execution_items ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS growth_execution_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID REFERENCES growth_recommendations(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_email TEXT,
  customer_phone TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'meta_ads')),
  personalized_message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'skipped')),
  external_message_id TEXT,
  error_message TEXT,
  attempts INT DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exec_items_recommendation
  ON growth_execution_items(recommendation_id, status);

CREATE INDEX IF NOT EXISTS idx_exec_items_profile
  ON growth_execution_items(profile_id);

ALTER TABLE growth_execution_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exec_items: owner only" ON growth_execution_items;
CREATE POLICY "exec_items: owner only" ON growth_execution_items
  FOR ALL USING (profile_id = auth.uid());

-- ── 3. growth_recommendations — expande status e adiciona colunas de execução ─

-- Remove constraint existente para substituição segura
DO $$
BEGIN
  ALTER TABLE growth_recommendations
    DROP CONSTRAINT IF EXISTS growth_recommendations_status_check;
  ALTER TABLE growth_recommendations
    ADD CONSTRAINT growth_recommendations_status_check
    CHECK (status IN (
      'pending', 'collaborating', 'awaiting_confirmation',
      'approved', 'executing', 'completed', 'failed',
      'dismissed', 'rejected', 'cancelled'
    ));
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE growth_recommendations
  ADD COLUMN IF NOT EXISTS collaboration_session_id UUID REFERENCES growth_collaboration_sessions(id),
  ADD COLUMN IF NOT EXISTS approved_message_template TEXT,
  ADD COLUMN IF NOT EXISTS approved_message_params JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS execution_channel TEXT CHECK (
    execution_channel IN ('whatsapp', 'email', 'meta_ads', 'manual')
  );

-- ── 4. whatsapp_messages — adiciona colunas para alinhamento com o serviço ────
-- A tabela já existe (migration 20260314000001) com colunas to_number e content.
-- Adicionamos as colunas novas sem remover as antigas para manter compatibilidade.

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS phone_to TEXT,
  ADD COLUMN IF NOT EXISTS message_body TEXT,
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- Preenche phone_to a partir de to_number nos registros existentes
UPDATE whatsapp_messages
  SET phone_to = to_number
  WHERE phone_to IS NULL AND to_number IS NOT NULL;

-- Preenche message_body a partir de content nos registros existentes
UPDATE whatsapp_messages
  SET message_body = content
  WHERE message_body IS NULL AND content IS NOT NULL;

-- Índice para growth_action_id (pode não existir dependendo da versão anterior)
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_growth_action
  ON whatsapp_messages(growth_action_id);

-- ── 5. email_campaigns ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  email_to TEXT NOT NULL,
  subject TEXT,
  body_html TEXT,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  resend_id TEXT,
  growth_action_id UUID,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_profile
  ON email_campaigns(profile_id, created_at DESC);

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_campaigns: owner only" ON email_campaigns;
CREATE POLICY "email_campaigns: owner only" ON email_campaigns
  FOR ALL USING (profile_id = auth.uid());
