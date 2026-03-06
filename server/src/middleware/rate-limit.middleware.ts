/**
 * @file middleware/rate-limit.middleware.ts
 *
 * Rate limiters por categoria de endpoint.
 * Todos usam IP como chave (padrão do express-rate-limit).
 */
import rateLimit from 'express-rate-limit';

// IA: 30 req/min — limita custo de API Claude e previne abuse
export const aiRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições ao chat. Aguarde 1 minuto.' },
});

// Sync/reports: 10 req/5min — operações pesadas que chamam APIs externas
export const syncRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições de sync. Aguarde alguns minutos.' },
});

// Geral: 300 req/min — proteção baseline para todos os endpoints
export const generalRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições. Aguarde um momento.' },
});
