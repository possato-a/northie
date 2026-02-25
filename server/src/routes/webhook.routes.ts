import { Router } from 'express';
import * as WebhookController from '../controllers/webhook.controller.js';

const router = Router();

/**
 * @route POST /api/webhooks/:platform
 * @desc Generic endpoint to receive webhooks from any platform
 */
router.post('/:platform', WebhookController.handleWebhook);

export default router;
