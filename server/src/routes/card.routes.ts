import { Router } from 'express';
import { getCapitalScore, getScoreHistory, getCardApplication, requestCard } from '../controllers/card.controller.js';

const router = Router();

router.get('/score', getCapitalScore);
router.get('/history', getScoreHistory);
router.get('/application', getCardApplication);
router.post('/request', requestCard);

export default router;
