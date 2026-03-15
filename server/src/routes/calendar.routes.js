import { Router } from 'express';
import { getEvents, getInsights, triggerSync, linkToCustomer, getCalendarStatus } from '../controllers/calendar.controller.js';

const router = Router();

router.get('/status', getCalendarStatus);
router.get('/events', getEvents);
router.get('/insights', getInsights);
router.post('/sync', triggerSync);
router.post('/link/:meetingId/:customerId', linkToCustomer);

export default router;
