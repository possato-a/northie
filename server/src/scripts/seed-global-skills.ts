import '../env.js';
import { createClient } from '@supabase/supabase-js';
import { GLOBAL_SKILLS } from '../claude/skills/global-seeds.js';

async function seed() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log(`Seeding ${GLOBAL_SKILLS.length} global skills...`);

  for (const skill of GLOBAL_SKILLS) {
    // Insert only if not already present (idempotent)
    const { data: existing } = await supabase
      .from('skills')
      .select('id')
      .eq('name', skill.name)
      .eq('is_global', true)
      .maybeSingle();

    if (existing) {
      console.log(`  - ${skill.name} (already exists, skipping)`);
      continue;
    }

    const { error } = await supabase
      .from('skills')
      .insert({
        name: skill.name,
        description: skill.description,
        content: skill.content,
        is_global: true,
        is_active: true,
        profile_id: null,
      });

    if (error) {
      console.error(`  x ${skill.name}:`, error.message);
    } else {
      console.log(`  ok ${skill.name}`);
    }
  }

  console.log('Done.');
  process.exit(0);
}

seed().catch(console.error);
