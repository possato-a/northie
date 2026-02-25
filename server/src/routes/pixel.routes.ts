import { Router } from 'express';
import * as PixelController from '../controllers/pixel.controller.js';

const router = Router();

/**
 * @route POST /api/pixel/event
 * @desc Endpoint to receive tracking events from the Northie Pixel
 */
router.post('/event', PixelController.handlePixelEvent);

export default router;
