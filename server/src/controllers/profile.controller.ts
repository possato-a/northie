import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

/**
 * DELETE /api/profile
 * Exclui permanentemente a conta do usuário autenticado.
 * O cliente usa service_role — supabase.auth.admin.deleteUser é permitido.
 * A FK profiles.id → auth.users(id) com ON DELETE CASCADE limpa os dados.
 */
export async function deleteAccount(req: Request, res: Response): Promise<void> {
    const profileId = req.headers['x-profile-id'] as string;

    try {
        // Deleta o usuário no Auth — cascata apaga o profiles e dados relacionados
        const { error } = await supabase.auth.admin.deleteUser(profileId);
        if (error) throw error;

        res.json({ ok: true });
    } catch (err: unknown) {
        console.error('[Profile] deleteAccount error:', err);
        res.status(500).json({ error: err instanceof Error ? err.message : 'Falha ao excluir conta' });
    }
}
