import { createClient } from '@supabase/supabase-js';

export interface SkillRow {
  id: string;
  name: string;
  content: string;
  is_global: boolean;
}

export async function getActiveSkills(profileId: string): Promise<SkillRow[]> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('skills')
    .select('id, name, content, is_global')
    .eq('is_active', true)
    .or(`profile_id.eq.${profileId},is_global.eq.true`)
    .order('is_global', { ascending: false });

  if (error) {
    console.error('[Skills] getActiveSkills error:', error.message);
    return [];
  }
  return data ?? [];
}
