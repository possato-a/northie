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
import { startTokenRefreshJob } from './jobs/token-refresh.job.js';
import { startAdsSyncJob } from './jobs/ads-sync.job.js';
import { startHotmartSyncJob } from './jobs/hotmart-sync.job.js';
import { startRfmCalcJob } from './jobs/rfm-calc.job.js';
import { webhookQueue } from './lib/webhook-queue.js';
import { startAlertsJob } from './jobs/alerts.job.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
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

// Basic Route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'northie-backend' });
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
    });
}

export default app;
