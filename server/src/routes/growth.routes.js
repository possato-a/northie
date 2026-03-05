import { Router } from 'express';
import * as GrowthController from '../controllers/growth.controller.js';
const router = Router();
/**
 * @route GET /api/growth/recommendations
 * @desc Lista recomendações pending + recentes
 */
router.get('/metrics', GrowthController.getGrowthMetrics);
router.get('/recommendations', GrowthController.listRecommendations);
/**
 * @route POST /api/growth/recommendations/:id/approve
 * @desc Aprova e dispara execução (202 Accepted)
 */
router.post('/recommendations/:id/approve', GrowthController.approveRecommendation);
/**
 * @route POST /api/growth/recommendations/:id/dismiss
 * @desc Descarta uma recomendação
 */
router.post('/recommendations/:id/dismiss', GrowthController.dismissRecommendation);
/**
 * @route GET /api/growth/recommendations/:id/status
 * @desc Polling de status + execution_log
 */
router.get('/recommendations/:id/status', GrowthController.getRecommendationStatus);
export default router;
//# sourceMappingURL=growth.routes.js.map