-- Remove Comunidade feature (produto descontinuado)

DROP TABLE IF EXISTS community_event_enrollments CASCADE;
DROP TABLE IF EXISTS community_drops CASCADE;
DROP TABLE IF EXISTS community_events CASCADE;
DROP TABLE IF EXISTS community_comments CASCADE;
DROP TABLE IF EXISTS community_likes CASCADE;
DROP TABLE IF EXISTS community_posts CASCADE;

ALTER TABLE profiles DROP COLUMN IF EXISTS community_points;
ALTER TABLE profiles DROP COLUMN IF EXISTS community_level;
ALTER TABLE profiles DROP COLUMN IF EXISTS community_joined_at;
ALTER TABLE profiles DROP COLUMN IF EXISTS community_display_name;
