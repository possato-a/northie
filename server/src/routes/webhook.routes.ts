import { Router } from 'express';
import * as WebhookController from '../controllers/webhook.controller.js';

const router = Router();

// NOTE: Stripe, Hotmart e Shopify são montados ANTES do express.json()
// diretamente no index.ts para garantir acesso ao raw body (HMAC/signature).
// Aqui fica apenas o handler genérico.

/**
 * @route POST /api/webhooks/:platform
 * @desc Generic endpoint to receive webhooks from any platform
 */
router.post('/:platform', WebhookController.handleWebhook);

export default router;
