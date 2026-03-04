import { Router } from 'express';
import express from 'express';
import * as WebhookController from '../controllers/webhook.controller.js';
const router = Router();
/**
 * @route POST /api/webhooks/stripe
 * @desc Stripe Connect webhook — raw body required for signature verification.
 * Must match before /:platform to avoid JSON parsing.
 */
router.post('/stripe', express.raw({ type: 'application/json' }), WebhookController.handleStripeWebhook);
/**
 * @route POST /api/webhooks/hotmart/:profileId
 * @desc Hotmart webhook com profileId na URL — cada founder usa a sua URL única.
 * Deve vir antes de /:platform para não ser capturado pelo handler genérico.
 */
router.post('/hotmart/:profileId', WebhookController.handleHotmartWebhook);
/**
 * @route POST /api/webhooks/:platform
 * @desc Generic endpoint to receive webhooks from any platform
 */
router.post('/:platform', WebhookController.handleWebhook);
export default router;
//# sourceMappingURL=webhook.routes.js.map