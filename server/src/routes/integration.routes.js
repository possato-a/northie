import { Router } from 'express';
import * as IntegrationController from '../controllers/integration.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { syncRateLimiter } from '../middleware/rate-limit.middleware.js';
const router = Router();
/**
 * @route GET /api/integrations/status
 * @desc Returns active integrations for the current profile (x-profile-id)
 */
router.get('/status', authMiddleware, IntegrationController.getIntegrationStatus);
/**
 * @route GET /api/integrations/connect/:platform
 * @desc Start OAuth flow for a platform (meta, google, etc.)
 * Protected — profileId comes from authMiddleware via Bearer JWT.
 */
router.get('/connect/:platform', authMiddleware, IntegrationController.connectPlatform);
/**
 * @route GET /api/integrations/callback/:platform
 * @desc OAuth Redirect URI callback — platform redirects here after user grants access.
 * Public — must be accessible without auth header.
 */
router.get('/callback/:platform', IntegrationController.handleCallback);
/**
 * @route POST /api/integrations/disconnect/:platform
 * @desc Deactivate integration for a platform
 */
router.post('/disconnect/:platform', authMiddleware, IntegrationController.disconnectPlatform);
/**
 * @route POST /api/integrations/sync/:platform
 * @desc Trigger immediate ad metrics sync. Body: { days?: number }
 */
router.post('/sync/:platform', authMiddleware, syncRateLimiter, IntegrationController.triggerSync);
/**
 * @route POST /api/integrations/meta/retroactive-attribution
 * @desc Cross-references Meta Lead Ads emails with Hotmart customers to retroactively
 *       attribute acquisition_channel = 'meta_ads' for matched unattributed customers.
 */
router.post('/meta/retroactive-attribution', authMiddleware, IntegrationController.metaRetroactiveAttribution);
/**
 * @route GET /api/integrations/cron/sync
 * @desc Called by Vercel Cron every 6h. Protected by CRON_SECRET internally.
 */
router.get('/cron/sync', IntegrationController.cronSync);
export default router;
//# sourceMappingURL=integration.routes.js.map