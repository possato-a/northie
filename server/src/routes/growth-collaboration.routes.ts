/**
 * @file routes/growth-collaboration.routes.ts
 *
 * Rotas do fluxo de colaboração founder <-> agente de execução.
 * Todas as rotas exigem autenticação via JWT (authMiddleware).
 *
 * Montagem: router.use('/', growthCollaborationRoutes) em growth.routes.ts
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import * as CollabController from '../controllers/growth-collaboration.controller.js';

const router = Router();

/**
 * @route POST /api/growth/recommendations/:id/collaborate
 * @desc Abre sessão de colaboração para uma recomendação pendente que exige colaboração.
 *       Retorna session_id, opening_message e segment_snapshot.
 */
router.post('/recommendations/:id/collaborate', authMiddleware, CollabController.startCollaboration);

/**
 * @route POST /api/growth/collaboration/:sessionId/message
 * @desc Envia mensagem do founder para o agente no loop de colaboração.
 *       Body: { message: string }
 *       Retorna: { reply: string, draft_message?: string }
 */
router.post('/collaboration/:sessionId/message', authMiddleware, CollabController.sendMessage);

/**
 * @route GET /api/growth/collaboration/:sessionId
 * @desc Retorna estado atual da sessão: messages, segment_snapshot, draft_message, status.
 */
router.get('/collaboration/:sessionId', authMiddleware, CollabController.getSession);

/**
 * @route POST /api/growth/collaboration/:sessionId/confirm
 * @desc Founder aprova template final e dispara execução em background.
 *       Body: { approved_message: string }
 *       Retorna: { execution_items_count, recommendation_id }
 */
router.post('/collaboration/:sessionId/confirm', authMiddleware, CollabController.confirmExecution);

/**
 * @route POST /api/growth/collaboration/:sessionId/abandon
 * @desc Founder cancela a sessão. Recomendação volta para status 'pending'.
 */
router.post('/collaboration/:sessionId/abandon', authMiddleware, CollabController.abandonSession);

export default router;
