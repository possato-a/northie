import { Router } from 'express';
import * as DashboardController from '../controllers/dashboard.controller.js';

const router = Router();

/**
 * @route GET /api/dashboard/stats
 * @desc General financial KPIs
 */
router.get('/stats', DashboardController.getGeneralStats);

/**
 * @route GET /api/dashboard/attribution
 * @desc ROI and revenue per acquisition channel
 */
router.get('/attribution', DashboardController.getAttributionStats);

/**
 * @route GET /api/dashboard/growth
 * @desc Revenue growth comparison
 */
router.get('/growth', DashboardController.getGrowthMetrics);

/**
 * @route GET /api/dashboard/chart
 * @desc Daily revenue time-series
 */
router.get('/chart', DashboardController.getRevenueChart);

export default router;
