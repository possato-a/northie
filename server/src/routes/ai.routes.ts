import { Router } from 'express';
import * as AIController from '../controllers/ai.controller.js';

const router = Router();

/**
 * @route POST /api/ai/chat
 * @desc Ask Northie for insights
 */
router.post('/chat', AIController.handleChatMessage);
router.delete('/history', AIController.clearChatHistory);

/**
 * @route POST /api/ai/growth-chat
 * @desc Growth-specific chat with expanded context and tool use
 */
router.post('/growth-chat', AIController.handleGrowthChatMessage);

export default router;
