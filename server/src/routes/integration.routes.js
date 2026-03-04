import { Router } from 'express';
import * as IntegrationController from '../controllers/integration.controller.js';
const router = Router();
/**
 * @route GET /api/integrations/status
 * @desc Returns active integrations for the current profile (x-profile-id)
 */
router.get('/status', IntegrationController.getIntegrationStatus);
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
/**
 * @route POST /api/integrations/disconnect/:platform
 * @desc Deactivate integration for a platform
 */
router.post('/disconnect/:platform', IntegrationController.disconnectPlatform);
/**
 * @route POST /api/integrations/sync/:platform
 * @desc Trigger immediate ad metrics sync. Body: { days?: number }
 */
router.post('/sync/:platform', IntegrationController.triggerSync);
/**
 * @route POST /api/integrations/meta/retroactive-attribution
 * @desc Cross-references Meta Lead Ads emails with Hotmart customers to retroactively
 *       attribute acquisition_channel = 'meta_ads' for matched unattributed customers.
 */
router.post('/meta/retroactive-attribution', IntegrationController.metaRetroactiveAttribution);
/**
 * @route GET /api/integrations/cron/sync
 * @desc Called by Vercel Cron every 6h. Protected by CRON_SECRET.
 */
router.get('/cron/sync', IntegrationController.cronSync);
export default router;
//# sourceMappingURL=integration.routes.js.map