/**
 * @file comunidade.controller.js
 * Endpoints da Comunidade Northie — posts, eventos, membros, drops
 */

import { supabase } from '../lib/supabase.js';

// ── Posts ──────────────────────────────────────────────────────────────────────

export async function getPosts(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId) return res.status(401).json({ error: 'Unauthorized' });

    const space = req.query.space || 'feed_geral';
    const limit = parseInt(req.query.limit) || 20;

    try {
        const { data: posts, error } = await supabase
            .from('community_posts')
            .select(`
                id, content, space, likes_count, comments_count, created_at,
                author:author_id (
                    id,
                    community_display_name,
                    community_level,
                    community_points,
                    business_type
                )
            `)
            .eq('space', space)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw new Error(error.message);

        // Verificar quais posts o usuário curtiu
        const postIds = posts?.map(p => p.id) || [];
        let likedPostIds = new Set();

        if (postIds.length > 0) {
            const { data: likes } = await supabase
                .from('community_likes')
                .select('post_id')
                .eq('user_id', profileId)
                .in('post_id', postIds);

            likedPostIds = new Set((likes || []).map(l => l.post_id));
        }

        const enriched = (posts || []).map(p => ({
            ...p,
            liked_by_me: likedPostIds.has(p.id),
        }));

        res.json({ data: enriched });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

export async function createPost(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId) return res.status(401).json({ error: 'Unauthorized' });

    const { content, space } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Conteúdo obrigatório' });

    try {
        const { data, error } = await supabase
            .from('community_posts')
            .insert({
                author_id: profileId,
                content: content.trim(),
                space: space || 'feed_geral',
            })
            .select()
            .single();

        if (error) throw new Error(error.message);

        // Incrementar pontos do founder
        await supabase.rpc('increment_community_points', { user_id: profileId, points: 5 }).catch(() => {});

        res.status(201).json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

export async function toggleLike(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId) return res.status(401).json({ error: 'Unauthorized' });

    const { id: postId } = req.params;

    try {
        // Verificar se já curtiu
        const { data: existing } = await supabase
            .from('community_likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', profileId)
            .single();

        if (existing) {
            // Remover curtida
            await supabase.from('community_likes').delete().eq('id', existing.id);
            await supabase
                .from('community_posts')
                .update({ likes_count: supabase.raw('likes_count - 1') })
                .eq('id', postId);
            res.json({ data: { liked: false } });
        } else {
            // Adicionar curtida
            await supabase.from('community_likes').insert({ post_id: postId, user_id: profileId });
            await supabase
                .from('community_posts')
                .update({ likes_count: supabase.raw('likes_count + 1') })
                .eq('id', postId);
            res.json({ data: { liked: true } });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

export async function getComments(req, res) {
    const { id: postId } = req.params;

    try {
        const { data, error } = await supabase
            .from('community_comments')
            .select(`
                id, content, created_at,
                author:author_id (
                    id, community_display_name, community_level
                )
            `)
            .eq('post_id', postId)
            .order('created_at', { ascending: true });

        if (error) throw new Error(error.message);
        res.json({ data: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

export async function addComment(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId) return res.status(401).json({ error: 'Unauthorized' });

    const { id: postId } = req.params;
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Conteúdo obrigatório' });

    try {
        const { data, error } = await supabase
            .from('community_comments')
            .insert({ post_id: postId, author_id: profileId, content: content.trim() })
            .select()
            .single();

        if (error) throw new Error(error.message);

        // Incrementar contador de comentários
        await supabase.from('community_posts')
            .update({ comments_count: supabase.raw('comments_count + 1') })
            .eq('id', postId);

        res.status(201).json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ── Membros ────────────────────────────────────────────────────────────────────

export async function getMembers(req, res) {
    const sort = req.query.sort || 'points'; // points | joined
    const limit = parseInt(req.query.limit) || 50;

    try {
        const orderBy = sort === 'points' ? 'community_points' : 'community_joined_at';

        const { data, error } = await supabase
            .from('profiles')
            .select('id, community_display_name, community_level, community_points, community_joined_at, business_type')
            .not('community_joined_at', 'is', null)
            .order(orderBy, { ascending: false })
            .limit(limit);

        if (error) throw new Error(error.message);
        res.json({ data: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

export async function getMyStats(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('community_points, community_level, community_joined_at, community_display_name')
            .eq('id', profileId)
            .single();

        const { count: postsCount } = await supabase
            .from('community_posts')
            .select('*', { count: 'exact', head: true })
            .eq('author_id', profileId);

        res.json({
            data: {
                ...profile,
                posts_count: postsCount || 0,
            },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ── Eventos ────────────────────────────────────────────────────────────────────

export async function getEvents(req, res) {
    const profileId = req.headers['x-profile-id'];

    try {
        const { data: events, error } = await supabase
            .from('community_events')
            .select('*')
            .order('scheduled_at', { ascending: false });

        if (error) throw new Error(error.message);

        // Verificar inscrições do usuário
        let enrolledIds = new Set();
        if (profileId) {
            const { data: enrollments } = await supabase
                .from('community_event_enrollments')
                .select('event_id')
                .eq('user_id', profileId);
            enrolledIds = new Set((enrollments || []).map(e => e.event_id));
        }

        const enriched = (events || []).map(e => ({
            ...e,
            enrolled: enrolledIds.has(e.id),
        }));

        res.json({ data: enriched });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

export async function enrollEvent(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId) return res.status(401).json({ error: 'Unauthorized' });

    const { id: eventId } = req.params;

    try {
        const { error } = await supabase
            .from('community_event_enrollments')
            .insert({ event_id: eventId, user_id: profileId });

        if (error?.code === '23505') {
            return res.status(409).json({ error: 'Já inscrito neste evento' });
        }
        if (error) throw new Error(error.message);

        // Incrementar contador
        await supabase
            .from('community_events')
            .update({ enrollments_count: supabase.raw('enrollments_count + 1') })
            .eq('id', eventId);

        res.json({ data: { enrolled: true } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ── Drops ──────────────────────────────────────────────────────────────────────

export async function getDrops(req, res) {
    try {
        const { data, error } = await supabase
            .from('community_drops')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        res.json({ data: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
