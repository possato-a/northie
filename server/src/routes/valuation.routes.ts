import { Router } from 'express';
import { getCurrentValuation, getValuationHistory } from '../controllers/valuation.controller.js';

const router = Router();

router.get('/current', getCurrentValuation);
router.get('/history', getValuationHistory);

export default router;
