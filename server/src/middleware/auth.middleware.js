import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase.js';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const IS_PROD = process.env.NODE_ENV === 'production';
// ── Verificação local (rápida, sem rede) ──────────────────────────────────────
function verifyLocal(token) {
    const payload = jwt.verify(token, JWT_SECRET);
    const userId = payload?.sub;
    if (!userId)
        throw new Error('missing sub');
    return userId;
}
// ── Verificação via Supabase API (fallback sem secret configurado) ─────────────
async function verifyRemote(token) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error ?? !user?.id)
        throw new Error(error?.message ?? 'invalid token');
    return user.id;
}
export async function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or malformed Authorization header' });
        return;
    }
    const token = authHeader.slice(7);
    try {
        let userId;
        if (JWT_SECRET) { userId = verifyLocal(token); }
        else if (!IS_PROD) {
            // Dev: decode without signature check (ES256 without JWKS)
            const decoded = jwt.decode(token);
            if (!decoded?.sub) throw new Error('invalid token format');
            const now = Math.floor(Date.now() / 1000);
            if (decoded.exp && decoded.exp < now) { const e = new Error('jwt expired'); e.name = 'TokenExpiredError'; throw e; }
            userId = decoded.sub;
        }
        else { userId = await verifyRemote(token); }
        // Sobrescreve x-profile-id com o userId extraído do JWT verificado.
        // Qualquer valor enviado pelo cliente é descartado aqui.
        res.locals.profileId = userId;
        req.headers['x-profile-id'] = userId;
        next();
    }
    catch (err) {
        const isExpired = err?.name === 'TokenExpiredError';
        res.status(401).json({
            error: isExpired ? 'Token expirado. Faça login novamente.' : 'Token inválido.',
        });
    }
}
//# sourceMappingURL=auth.middleware.js.map