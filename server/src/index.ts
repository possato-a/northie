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
import dataRoutes from './routes/data.routes.js';
import { startTokenRefreshJob } from './jobs/token-refresh.job.js';

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
app.use('/api/data', dataRoutes);

// Basic Route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'northie-backend' });
});

// Start server only if not in Vercel (Production)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Northie Backend running on port ${PORT}`);
        startTokenRefreshJob();
    });
}

export default app;
