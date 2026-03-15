import { Router } from 'express';
import * as PixelController from '../controllers/pixel.controller.js';

const router = Router();

/**
 * @route GET /api/pixel/snippet
 * @desc Retorna o snippet JS do Northie Pixel gerado com o profileId do founder
 * @header x-profile-id (injetado pelo authMiddleware via JWT Bearer)
 */
router.get('/snippet', PixelController.getPixelSnippet);

/**
 * @route GET /api/pixel/stats
 * @desc Retorna estatísticas de rastreamento do pixel (total_visits, unique_visitors, top_sources)
 * @header x-profile-id (injetado pelo authMiddleware via JWT Bearer)
 */
router.get('/stats', PixelController.getPixelStats);

/**
 * @route POST /api/pixel/event
 * @desc Endpoint to receive tracking events from the Northie Pixel (rota pública — chamada de sites externos)
 */
router.post('/event', PixelController.handlePixelEvent);

export default router;
