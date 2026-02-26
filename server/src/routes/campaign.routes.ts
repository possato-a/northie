import { Router } from 'express';
import * as CampaignController from '../controllers/campaign.controller.js';

const router = Router();

router.get('/', CampaignController.listCampaigns);
router.post('/', CampaignController.createCampaign);
router.get('/:id/creators', CampaignController.listCampaignCreators);
router.post('/add-creator', CampaignController.addCreatorToCampaign);
router.post('/confirm-payout', CampaignController.confirmPayout);

export default router;
