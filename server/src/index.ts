import express from 'express';
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
import { handleStripeWebhook, handleHotmartWebhook, handleShopifyWebhook } from './controllers/webhook.controller.js';
import { handleResendWebhook } from './controllers/resend-webhook.controller.js';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(helmet());
app.use(cors());
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

app.use(express.json());

// Routes
app.use('/api/webhooks', webhookRoutes);
app.use('/api/pixel', pixelRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/growth', growthRoutes);
app.use('/api/card', cardRoutes);
app.use('/api/valuation', valuationRoutes);
app.use('/api/reports', reportsRoutes);

// Basic Route
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'northie-backend', version: 'v13' });
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
    });
}

export default app;
