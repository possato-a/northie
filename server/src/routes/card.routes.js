import { Router } from 'express';
import { getCapitalScore, getScoreHistory } from '../controllers/card.controller.js';
const router = Router();
router.get('/score', getCapitalScore);
router.get('/history', getScoreHistory);
export default router;
//# sourceMappingURL=card.routes.js.map