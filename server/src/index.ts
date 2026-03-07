import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import webhookRoutes from './routes/webhook.routes.js';
import pixelRoutes from './routes/pixel.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import aiRoutes from './routes/ai.routes.js';
import integrationRoutes from './routes/integration.routes.js';
import cronRoutes from './routes/cron.routes.js';
import dataRoutes from './routes/data.routes.js';
import campaignRoutes from './routes/campaign.routes.js';
import growthRoutes from './routes/growth.routes.js';
import cardRoutes from './routes/card.routes.js';
import valuationRoutes from './routes/valuation.routes.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { generalRateLimiter, aiRateLimiter } from './middleware/rate-limit.middleware.js';
import { startTokenRefreshJob } from './jobs/token-refresh.job.js';
import { startAdsSyncJob } from './jobs/ads-sync.job.js';
import { startHotmartSyncJob } from './jobs/hotmart-sync.job.js';
import { startRfmCalcJob } from './jobs/rfm-calc.job.js';
import { webhookQueue } from './lib/webhook-queue.js';
import { startAlertsJob } from './jobs/alerts.job.js';
import { startGrowthCorrelationsJob } from './jobs/growth-correlations.job.js';
import { startCorrelationRefreshJob } from './jobs/correlation-refresh.job.js';
import { startSafetyNetJob } from './jobs/safety-net.job.js';
import { startCapitalScoreJob } from './jobs/capital-score.job.js';
import { startValuationCalcJob } from './jobs/valuation-calc.job.js';
import { startShopifySyncJob } from './jobs/shopify-sync.job.js';
import reportsRoutes from './routes/reports.routes.js';
import { startReportsJob } from './jobs/reports.job.js';
import { startChatCleanupJob } from './jobs/chat-cleanup.job.js';
import { handleStripeWebhook, handleHotmartWebhook, handleShopifyWebhook } from './controllers/webhook.controller.js';
import { handleResendWebhook } from './controllers/resend-webhook.controller.js';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(helmet());

const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3001',
].filter(Boolean) as string[];

app.use(cors({
    origin: (origin, callback) => {
        // Allow server-to-server requests (no origin) and known origins
        if (!origin || allowedOrigins.includes(origin)) callback(null, true);
        else callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));

app.use(generalRateLimiter);
app.use(morgan('dev'));

// Webhooks com raw body DEVEM ser montados antes do express.json()
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);
app.post('/api/webhooks/hotmart/:profileId', express.raw({ type: 'application/json' }), handleHotmartWebhook);
app.post('/api/webhooks/shopify/:profileId', express.raw({ type: 'application/json' }), handleShopifyWebhook);
app.post('/api/webhooks/resend', express.raw({ type: 'application/json' }), (req, res, next) => {
    // Expõe rawBody para verificação de assinatura Svix
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).rawBody = req.body as Buffer;
    next();
}, handleResendWebhook);

app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/webhooks', webhookRoutes);
app.use('/api/pixel', pixelRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/ai', authMiddleware, aiRateLimiter, aiRoutes);
app.use('/api/integrations', integrationRoutes); // auth handled per-route in integration.routes.ts
app.use('/api/cron', cronRoutes);                // protected by CRON_SECRET internally
app.use('/api/data', authMiddleware, dataRoutes);
app.use('/api/campaigns', authMiddleware, campaignRoutes);
app.use('/api/growth', authMiddleware, growthRoutes);
app.use('/api/card', authMiddleware, cardRoutes);
app.use('/api/valuation', authMiddleware, valuationRoutes);
app.use('/api/reports', authMiddleware, reportsRoutes);

// Basic Route
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'northie-backend', version: 'v13' });
});

// Global error handler — captura qualquer erro não tratado nas rotas (Express 5 propaga async throws)
// Sem isso, Express retorna HTML 500; com isso, retorna JSON consistente
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Express] Unhandled error:', message);
    if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error', debug: { message } });
    }
});



// Start server only if not in Vercel (Production)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Northie Backend running on port ${PORT}`);
        startTokenRefreshJob();
        startAdsSyncJob();
        startHotmartSyncJob();
        startRfmCalcJob();
        webhookQueue.recoverPending();
        startAlertsJob();
        startGrowthCorrelationsJob();
        startCorrelationRefreshJob();
        startSafetyNetJob();
        startCapitalScoreJob();
        startValuationCalcJob();
        startShopifySyncJob();
        startReportsJob();
        startChatCleanupJob();
    });
}

export default app;
