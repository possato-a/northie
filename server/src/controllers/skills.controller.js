import { createClient } from '@supabase/supabase-js';
function getSupabase() {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}
export async function listSkills(req, res) {
    const profileId = res.locals.profileId;
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('skills')
        .select('id, name, description, content, is_active, is_global, created_at')
        .or(`profile_id.eq.${profileId},is_global.eq.true`)
        .order('is_global', { ascending: false })
        .order('created_at', { ascending: true });
    if (error)
        return res.status(500).json({ error: error.message });
    return res.json(data);
}
export async function createSkill(req, res) {
    const profileId = res.locals.profileId;
    const { name, description, content } = req.body;
    if (!name?.trim() || !content?.trim()) {
        return res.status(400).json({ error: 'name and content are required' });
    }
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('skills')
        .insert({ profile_id: profileId, name: name.trim(), description, content: content.trim(), is_global: false })
        .select()
        .single();
    if (error)
        return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
}
export async function updateSkill(req, res) {
    const profileId = res.locals.profileId;
    const { id } = req.params;
    const { name, description, content } = req.body;
    const supabase = getSupabase();
    // Only allow editing own skills (not global)
    const { data, error } = await supabase
        .from('skills')
        .update({ name, description, content })
        .eq('id', id)
        .eq('profile_id', profileId)
        .eq('is_global', false)
        .select()
        .single();
    if (error)
        return res.status(500).json({ error: error.message });
    if (!data)
        return res.status(404).json({ error: 'Skill not found or not owned by you' });
    return res.json(data);
}
export async function toggleSkill(req, res) {
    const profileId = res.locals.profileId;
    const { id } = req.params;
    const supabase = getSupabase();
    // First get current state — allow toggling own + global skills
    const { data: current } = await supabase
        .from('skills')
        .select('is_active, is_global, profile_id')
        .eq('id', id)
        .single();
    if (!current)
        return res.status(404).json({ error: 'Skill not found' });
    // Can toggle own skills; cannot toggle global ones
    if (current.is_global)
        return res.status(403).json({ error: 'Cannot toggle global skills' });
    if (current.profile_id !== profileId)
        return res.status(403).json({ error: 'Not your skill' });
    const { data, error } = await supabase
        .from('skills')
        .update({ is_active: !current.is_active })
        .eq('id', id)
        .select()
        .single();
    if (error)
        return res.status(500).json({ error: error.message });
    return res.json(data);
}
export async function deleteSkill(req, res) {
    const profileId = res.locals.profileId;
    const { id } = req.params;
    const supabase = getSupabase();
    const { error, count } = await supabase
        .from('skills')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('profile_id', profileId)
        .eq('is_global', false);
    if (error)
        return res.status(500).json({ error: error.message });
    if (count === 0)
        return res.status(404).json({ error: 'Skill not found or not deletable' });
    return res.status(204).send();
}
//# sourceMappingURL=skills.controller.js.map