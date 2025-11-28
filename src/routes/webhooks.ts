import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller';

const router = Router();
const whatsAppController = new WhatsAppController();

// Webhook verification (GET) - Meta uses this to verify your webhook
router.get('/whatsapp', whatsAppController.verifyWebhook);

// Webhook events (POST) - Meta sends messages and status updates here
router.post('/whatsapp', whatsAppController.handleWebhook);

export default router;
