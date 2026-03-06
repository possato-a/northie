import { Router } from 'express';
import * as ReportsController from '../controllers/reports.controller.js';
const router = Router();
router.get('/config', ReportsController.getReportConfig);
router.post('/config', ReportsController.saveReportConfig);
router.get('/preview', ReportsController.getReportPreview);
router.get('/ai-analysis', ReportsController.getReportAIAnalysis);
router.post('/generate', ReportsController.generateReport);
router.get('/export', ReportsController.exportReport);
router.get('/logs', ReportsController.getReportLogs);
router.get('/logs/:id/download', ReportsController.downloadLogReport);
router.post('/send-email', ReportsController.sendReportByEmail);
export default router;
//# sourceMappingURL=reports.routes.js.map