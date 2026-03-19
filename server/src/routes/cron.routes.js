import { Router } from 'express';
import { cronSync, cronReports } from '../controllers/integration.controller.js';
const router = Router();
/**
 * @route GET /api/cron/sync
 * @desc Called by Vercel Cron daily. Runs full sync pipeline + scheduled reports.
 */
router.get('/sync', cronSync);
/**
 * @route GET /api/cron/reports
 * @desc Called by Vercel Cron every 4h. Processes only scheduled reports.
 */
router.get('/reports', cronReports);
export default router;
//# sourceMappingURL=cron.routes.js.map