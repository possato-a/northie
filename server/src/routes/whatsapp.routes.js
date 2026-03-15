import { Router } from 'express';
import { verifyWebhook, receiveWebhook, sendMessage, testWhatsApp, getStatus } from '../controllers/whatsapp.controller.js';

const router = Router();

// Webhook Meta (sem auth — chamado pelo Meta)
router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveWebhook);

// Autenticados
router.get('/status', getStatus);
router.post('/send', sendMessage);
router.post('/test', testWhatsApp);

export default router;
