/**
 * @file middleware/auth.middleware.ts
 *
 * Verifica o JWT do Supabase em toda requisição protegida.
 * Extrai o userId do token verificado e sobrescreve req.headers['x-profile-id']
 * — controllers não precisam mudar, mas o profileId agora vem do token, nunca do cliente.
 *
 * Estratégia de verificação (em ordem de preferência):
 *
 * 1. JWT local com SUPABASE_JWT_SECRET → síncrono, 0 latência extra.
 *    Configure via: Dashboard Supabase → Settings → API → JWT Settings → JWT Secret.
 *
 * 2. Supabase auth.getUser(token) → valida via rede (~100ms), mas não exige o secret.
 *    Funciona imediatamente com SERVICE_ROLE_KEY já configurado.
 *
 * Em produção, prefira a opção 1 — adicione SUPABASE_JWT_SECRET no Vercel.
 */
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase.js';

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

if (!JWT_SECRET) {
    console.warn('[Auth] SUPABASE_JWT_SECRET não configurada — usando validação via Supabase API (adicione a variável para melhor performance).');
}

// ── Verificação local (rápida, sem rede) ──────────────────────────────────────
function verifyLocal(token: string): string {
    const payload = jwt.verify(token, JWT_SECRET!) as jwt.JwtPayload;
    const userId = payload?.sub;
    if (!userId) throw new Error('missing sub');
    return userId;
}

// ── Verificação via Supabase API (fallback sem secret configurado) ─────────────
async function verifyRemote(token: string): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error ?? !user?.id) throw new Error(error?.message ?? 'invalid token');
    return user.id;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or malformed Authorization header' });
        return;
    }

    const token = authHeader.slice(7);

    try {
        const userId = JWT_SECRET ? verifyLocal(token) : await verifyRemote(token);

        // Sobrescreve x-profile-id com o userId extraído do JWT verificado.
        // Qualquer valor enviado pelo cliente é descartado aqui.
        req.headers['x-profile-id'] = userId;

        next();
    } catch (err: unknown) {
        const isExpired = (err as jwt.JsonWebTokenError)?.name === 'TokenExpiredError';
        console.warn('[Auth] JWT verification failed:', err instanceof Error ? err.message : String(err));
        res.status(401).json({
            error: isExpired ? 'Token expirado. Faça login novamente.' : 'Token inválido.',
        });
    }
}
