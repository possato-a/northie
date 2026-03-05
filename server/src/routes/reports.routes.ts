import { Router } from 'express';
import * as ReportsController from '../controllers/reports.controller.js';

const router = Router();
router.get('/config', ReportsController.getReportConfig);
router.post('/config', ReportsController.saveReportConfig);
router.get('/preview', ReportsController.getReportPreview);
router.post('/generate', ReportsController.generateReport);
router.get('/logs', ReportsController.getReportLogs);
router.post('/send-email', ReportsController.sendReportByEmail);

export default router;
