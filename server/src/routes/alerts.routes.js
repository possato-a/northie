import { Router } from 'express';
import { getAlerts, markRead, markAllRead } from '../controllers/alerts.controller.js';
const router = Router();
router.get('/', getAlerts);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);
export default router;
//# sourceMappingURL=alerts.routes.js.map