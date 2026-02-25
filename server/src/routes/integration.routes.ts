import { Router } from 'express';
import * as IntegrationController from '../controllers/integration.controller.js';

const router = Router();

/**
 * @route GET /api/integrations/connect/:platform
 * @desc Start OAuth flow for a platform (meta, google, etc.)
 */
router.get('/connect/:platform', IntegrationController.connectPlatform);

/**
 * @route GET /api/integrations/callback/:platform
 * @desc OAuth Redirect URI callback
 */
router.get('/callback/:platform', IntegrationController.handleCallback);

export default router;
