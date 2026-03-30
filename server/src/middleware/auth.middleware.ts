/**
 * @file middleware/auth.middleware.ts
 *
 * Estratégias de verificação JWT (em ordem de preferência):
 *
 * 1. SUPABASE_JWT_SECRET configurada → verifyLocal (HS256, síncrono, sem rede).
 * 2. NODE_ENV !== 'production' → verifyLocalDev: decodifica sem checar assinatura,
 *    mas valida exp e iss. Usado em dev local onde o Supabase auth pode ser lento/inacessível.
 * 3. Produção sem secret → verifyRemote via supabase.auth.getUser() (rede, ~100ms no Vercel).
 */
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase.js';

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Verificação local HS256 (rápida, sem rede) ────────────────────────────────
function verifyLocal(token: string): string {
    const payload = jwt.verify(token, JWT_SECRET!) as jwt.JwtPayload;
    const userId = payload?.sub;
    if (!userId) throw new Error('missing sub');
    return userId;
}

// ── Dev local: decodifica sem verificar assinatura (ES256 sem JWKS disponível) ─
// Valida exp, iss e sub. NÃO é seguro para produção.
function verifyLocalDev(token: string): string {
    const decoded = jwt.decode(token) as jwt.JwtPayload | null;
    if (!decoded?.sub) throw new Error('invalid token format');
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
        const err = new Error('jwt expired');
        (err as unknown as Record<string, string>).name = 'TokenExpiredError';
        throw err;
    }
    const expectedIss = (process.env.SUPABASE_URL ?? '') + '/auth/v1';
    if (decoded.iss !== expectedIss) throw new Error('invalid issuer');
    return decoded.sub;
}

// ── Produção: valida via Supabase API (requer rede, rápido no Vercel) ──────────
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
        let userId: string;
        if (JWT_SECRET) {
            userId = verifyLocal(token);
        } else if (!IS_PROD) {
            userId = verifyLocalDev(token);
        } else {
            userId = await verifyRemote(token);
        }

        res.locals.profileId = userId;
        req.headers['x-profile-id'] = userId;
        next();
    } catch (err: unknown) {
        const isExpired = err instanceof Error && (err.name === 'TokenExpiredError' || err.message === 'jwt expired');
        console.warn('[Auth] JWT verification failed:', err instanceof Error ? err.message : String(err));
        res.status(401).json({
            error: isExpired ? 'Token expirado. Faça login novamente.' : 'Token inválido.',
        });
    }
}
