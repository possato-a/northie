import { Router } from 'express';
import { chatWithAgent, listAgents } from '../controllers/agents.controller.js';
import { aiRateLimiter } from '../middleware/rate-limit.middleware.js';

const router = Router();
router.get('/list', listAgents);
router.post('/chat', aiRateLimiter, chatWithAgent);
export default router;
