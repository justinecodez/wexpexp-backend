import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const whatsAppController = new WhatsAppController();

// Apply authentication to all routes
// router.use(authenticateToken); // Uncomment if auth is needed

// Send template message
router.post('/send-template', whatsAppController.sendTemplate);

export default router;
