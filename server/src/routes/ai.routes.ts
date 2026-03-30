import { Router } from 'express';
import * as AIController from '../controllers/ai.controller.js';

const router = Router();

/**
 * POST /api/ai/chat
 * Body: { message, mode?: 'general'|'growth', page_context? }
 * Query: ?stream=true para SSE (futuro)
 */
router.post('/chat', AIController.handleChatMessage);

/**
 * DELETE /api/ai/history
 * Query: ?mode=general|growth (opcional — sem param limpa tudo)
 */
router.delete('/history', AIController.clearChatHistory);

export default router;
