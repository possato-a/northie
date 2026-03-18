import { Router } from 'express';
import { verifyWebhook, receiveWebhook, sendMessage, testWhatsApp, getStatus } from '../controllers/whatsapp.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Webhook Meta (sem auth — chamado pelo Meta)
router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveWebhook);

// Autenticados — requerem JWT válido
router.get('/status', authMiddleware, getStatus);
router.post('/send', authMiddleware, sendMessage);
router.post('/test', authMiddleware, testWhatsApp);

export default router;
