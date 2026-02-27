import { Router } from 'express';
import { cronSync } from '../controllers/integration.controller.js';

const router = Router();

/**
 * @route GET /api/cron/sync
 * @desc Called by Vercel Cron daily. Protected by CRON_SECRET.
 */
router.get('/sync', cronSync);

export default router;
