import { Router } from 'express';
import { chatWithAgent } from '../controllers/agents.controller.js';
import { aiRateLimiter } from '../middleware/rate-limit.middleware.js';
const router = Router();
router.post('/chat', aiRateLimiter, chatWithAgent);
export default router;
//# sourceMappingURL=agents.routes.js.map