import { Router } from 'express';
import * as PipelineController from '../controllers/pipeline.controller.js';

const router = Router();

router.get('/leads', PipelineController.listLeads);
router.post('/leads', PipelineController.createLead);
router.patch('/leads/:id', PipelineController.updateLead);
router.delete('/leads/:id', PipelineController.deleteLead);

router.get('/meetings', PipelineController.listMeetings);
router.post('/meetings', PipelineController.createMeeting);
router.patch('/meetings/:id', PipelineController.updateMeeting);

export default router;
