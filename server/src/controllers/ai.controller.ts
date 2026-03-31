import type { Request, Response } from 'express';
import { chat } from '../claude/index.js';
import { supabase } from '../lib/supabase.js';
import type { ChatMode } from '../claude/types.js';

/**
 * POST /api/ai/chat
 *
 * Body: { message: string, mode?: 'general' | 'growth', page_context?: string }
 * profileId vem de req.user.id (injetado pelo authMiddleware via res.locals)
 * ou de x-profile-id como fallback de compatibilidade.
 */
export async function handleChatMessage(req: Request, res: Response) {
  const profileId: string = (res.locals.profileId as string) || (req.headers['x-profile-id'] as string);
  const { message, mode, page_context, model } = req.body as {
    message?: string;
    mode?: ChatMode;
    page_context?: string;
    model?: string;
  };

  if (!profileId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Campo "message" é obrigatório.' });
  }

  const resolvedMode: ChatMode = mode === 'growth' ? 'growth' : 'general';

  try {
    const response = await chat(profileId, {
      message: message.trim(),
      mode: resolvedMode,
      pageContext: page_context ?? 'Visão Geral',
      model: model ?? 'sonnet',
    });

    return res.status(200).json(response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AI Controller] handleChatMessage erro:', msg);
    return res.status(500).json({ error: 'Erro interno ao processar mensagem.' });
  }
}

/**
 * DELETE /api/ai/history
 *
 * Query param opcional: ?mode=general|growth para limpar apenas um modo.
 * Sem query param: limpa todo o histórico do profileId.
 */
export async function clearChatHistory(req: Request, res: Response) {
  const profileId: string = (res.locals.profileId as string) || (req.headers['x-profile-id'] as string);
  if (!profileId) return res.status(401).json({ error: 'Unauthorized' });

  const mode = req.query['mode'] as string | undefined;

  let query = supabase.from('ai_chat_history').delete().eq('user_id', profileId);
  if (mode === 'general' || mode === 'growth') {
    query = query.eq('mode', mode);
  }

  const { error } = await query;
  if (error) {
    console.error('[AI Controller] clearChatHistory erro:', error.message);
    return res.status(500).json({ error: 'Falha ao limpar histórico.' });
  }

  return res.status(200).json({ ok: true });
}
