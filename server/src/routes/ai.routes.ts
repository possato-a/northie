import { Router } from 'express';
import * as AIController from '../controllers/ai.controller.js';

const router = Router();

/**
 * @route POST /api/ai/chat
 * @desc Ask Northie for insights
 */
router.post('/chat', AIController.handleChatMessage);

export default router;
