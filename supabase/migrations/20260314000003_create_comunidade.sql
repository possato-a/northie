-- Tabelas da Comunidade Northie: posts, likes, comentários, eventos, drops, ranking

-- Adicionar campos de comunidade nos profiles existentes
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS community_points integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS community_level text DEFAULT 'member'; -- member | og | inner_circle
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS community_joined_at timestamptz DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS community_display_name text;

-- Posts da comunidade
CREATE TABLE IF NOT EXISTS community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  space text NOT NULL DEFAULT 'feed_geral', -- feed_geral | novidades | votacoes | bastidores
  content text NOT NULL,
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_posts_select" ON community_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "community_posts_insert" ON community_posts FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "community_posts_delete" ON community_posts FOR DELETE USING (author_id = auth.uid());
CREATE INDEX idx_community_posts_space ON community_posts(space, created_at DESC);
CREATE INDEX idx_community_posts_author ON community_posts(author_id);

-- Curtidas
CREATE TABLE IF NOT EXISTS community_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
ALTER TABLE community_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_likes_select" ON community_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "community_likes_insert" ON community_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "community_likes_delete" ON community_likes FOR DELETE USING (user_id = auth.uid());

-- Comentários
CREATE TABLE IF NOT EXISTS community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_comments_select" ON community_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "community_comments_insert" ON community_comments FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "community_comments_delete" ON community_comments FOR DELETE USING (author_id = auth.uid());
CREATE INDEX idx_community_comments_post ON community_comments(post_id, created_at ASC);

-- Eventos
CREATE TABLE IF NOT EXISTS community_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL,              -- live | qa | workshop | office_hours
  description text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  meet_url text,
  replay_url text,
  replay_duration_minutes integer,
  enrollments_count integer DEFAULT 0,
  max_enrollments integer,
  status text DEFAULT 'upcoming', -- upcoming | live | completed
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE community_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_events_select" ON community_events FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_community_events_scheduled ON community_events(scheduled_at DESC);

-- Inscrições em eventos
CREATE TABLE IF NOT EXISTS community_event_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE community_event_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrollments_all" ON community_event_enrollments FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Drops (conteúdo exclusivo à venda)
CREATE TABLE IF NOT EXISTS community_drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  price_brl numeric NOT NULL DEFAULT 0,
  total_slots integer NOT NULL DEFAULT 100,
  sold_slots integer DEFAULT 0,
  status text DEFAULT 'active',  -- active | completed
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE community_drops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_drops_select" ON community_drops FOR SELECT TO authenticated USING (true);
