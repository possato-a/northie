import { Router } from 'express';
import * as GrowthController from '../controllers/growth.controller.js';
import { syncRateLimiter } from '../middleware/rate-limit.middleware.js';

const router = Router();

/**
 * @route POST /api/growth/diagnostic
 * @desc Executa pipeline multi-agente de diagnóstico (4 chamadas sequenciais ao Claude).
 *       Body: { days?: number } — default 30, máximo 90.
 *       Rate-limited: máximo 10 execuções por 5 minutos.
 */
router.post('/diagnostic', syncRateLimiter, GrowthController.runGrowthDiagnostic);

/**
 * @route GET /api/growth/diagnostic/latest
 * @desc Retorna o diagnóstico mais recente sem re-rodar os agentes.
 */
router.get('/diagnostic/latest', GrowthController.getGrowthDiagnosticLatest);

/**
 * @route GET /api/growth/metrics
 * @route GET /api/growth/recommendations
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
 * @desc Descarta uma recomendação ("agora não")
 */
router.post('/recommendations/:id/dismiss', GrowthController.dismissRecommendation);

/**
 * @route POST /api/growth/recommendations/:id/reject
 * @desc Rejeição definitiva (founder não quer essa ação)
 */
router.post('/recommendations/:id/reject', GrowthController.rejectRecommendation);

/**
 * @route POST /api/growth/recommendations/:id/cancel
 * @desc Cancela execução em andamento (approved/executing)
 */
router.post('/recommendations/:id/cancel', GrowthController.cancelRecommendation);

/**
 * @route GET /api/growth/recommendations/:id/status
 * @desc Polling de status + execution_log
 */
router.get('/recommendations/:id/status', GrowthController.getRecommendationStatus);

export default router;
