import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase.js';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
if (!JWT_SECRET) {
    console.warn('[Auth] SUPABASE_JWT_SECRET não configurada — usando validação via Supabase API (adicione a variável para melhor performance).');
}
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
        const userId = JWT_SECRET ? verifyLocal(token) : await verifyRemote(token);
        // Sobrescreve x-profile-id com o userId extraído do JWT verificado.
        // Qualquer valor enviado pelo cliente é descartado aqui.
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