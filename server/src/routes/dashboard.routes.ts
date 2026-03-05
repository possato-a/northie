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

/**
 * @route GET /api/dashboard/heatmap
 * @desc Daily sales intensity
 */
router.get('/heatmap', DashboardController.getSalesHeatmap);

/**
 * @route GET /api/dashboard/retention
 * @desc Cohort retention data
 */
router.get('/retention', DashboardController.getRetentionCohort);

/**
 * @route GET /api/dashboard/top-customers
 * @desc Top customers by LTV
 */
router.get('/top-customers', DashboardController.getTopCustomers);
router.get('/full', DashboardController.getFullDashboard);
router.get('/channel-trends', DashboardController.getChannelTrends);
router.get('/ad-campaigns', DashboardController.getAdCampaigns);
router.get('/ad-campaigns/:campaignId', DashboardController.getAdCampaignDetail);

export default router;
