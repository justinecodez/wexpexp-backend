import express from 'express';
import { CommunicationController } from '../controllers/communicationController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { sendEmailSchema, sendSMSSchema, sendBulkMessageSchema } from '../validation/basicValidation';

const router = express.Router();
const communicationController = new CommunicationController();

// Send email (authenticated)
router.post('/send-email', authenticateToken, validateBody(sendEmailSchema), communicationController.sendEmail);

// Send SMS (authenticated)
router.post('/send-sms', authenticateToken, validateBody(sendSMSSchema), communicationController.sendSMS);

// Send WhatsApp message (authenticated)
router.post('/send-whatsapp', authenticateToken, communicationController.sendWhatsApp);

// Send bulk messages (admin only)
router.post('/send-bulk', authenticateToken, requireAdmin, validateBody(sendBulkMessageSchema), communicationController.sendBulkMessages);

// Get message history (authenticated)
router.get('/messages', authenticateToken, communicationController.getMessageHistory);

// Get message by ID (authenticated)
router.get('/messages/:id', authenticateToken, communicationController.getMessageById);

// Get message templates (authenticated)
router.get('/templates', authenticateToken, communicationController.getMessageTemplates);

// Create message template (admin only)
router.post('/templates', authenticateToken, requireAdmin, communicationController.createMessageTemplate);

// Update message template (admin only)
router.put('/templates/:id', authenticateToken, requireAdmin, communicationController.updateMessageTemplate);

// Delete message template (admin only)
router.delete('/templates/:id', authenticateToken, requireAdmin, communicationController.deleteMessageTemplate);

// Get communication statistics (admin only)
router.get('/stats', authenticateToken, requireAdmin, communicationController.getCommunicationStats);

// Get delivery reports (authenticated)
router.get('/delivery-reports', authenticateToken, communicationController.getDeliveryReports);

// Test communication channels (admin only)
router.post('/test-channels', authenticateToken, requireAdmin, communicationController.testCommunicationChannels);

// Get communication preferences (authenticated)
router.get('/preferences', authenticateToken, communicationController.getUserPreferences);

// Update communication preferences (authenticated)
router.put('/preferences', authenticateToken, communicationController.updateUserPreferences);

// Unsubscribe from communications (public)
router.post('/unsubscribe', communicationController.unsubscribeUser);

// Get SMS provider status (admin only)
router.get('/sms-status', authenticateToken, requireAdmin, communicationController.getSMSProviderStatus);

// Get email service status (admin only)
router.get('/email-status', authenticateToken, requireAdmin, communicationController.getEmailServiceStatus);

export default router;
