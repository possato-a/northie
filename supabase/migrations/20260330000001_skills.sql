CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Skills globais da Northie não têm profile_id
CREATE INDEX idx_skills_profile ON skills(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX idx_skills_global ON skills(is_global) WHERE is_global = true;

-- RLS
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

-- Founders podem ver suas próprias skills + todas as globais
CREATE POLICY "skills_select" ON skills
  FOR SELECT USING (
    profile_id = auth.uid() OR is_global = true
  );

-- Founders só podem criar/editar/deletar skills próprias (não globais)
CREATE POLICY "skills_insert" ON skills
  FOR INSERT WITH CHECK (
    profile_id = auth.uid() AND is_global = false
  );

CREATE POLICY "skills_update" ON skills
  FOR UPDATE USING (
    profile_id = auth.uid() AND is_global = false
  );

CREATE POLICY "skills_delete" ON skills
  FOR DELETE USING (
    profile_id = auth.uid() AND is_global = false
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_skills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER skills_updated_at
  BEFORE UPDATE ON skills
  FOR EACH ROW EXECUTE FUNCTION update_skills_updated_at();
