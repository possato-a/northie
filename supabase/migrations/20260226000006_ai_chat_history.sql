-- Tabela para histórico de conversas com a IA (Ask Northie)
CREATE TABLE IF NOT EXISTS ai_chat_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content     TEXT NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_history_profile
    ON ai_chat_history(profile_id, created_at DESC);

-- RLS
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_chat_history: owner only" ON ai_chat_history;
CREATE POLICY "ai_chat_history: owner only" ON ai_chat_history
    FOR ALL USING (profile_id = auth.uid());
