import { Router } from 'express';
import conversationController from '../controllers/conversationController';
import { authenticateToken } from '../middleware/auth';
import { chatLimiter } from '../middleware/rateLimit';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Apply chat rate limiter to all conversation routes
router.use(chatLimiter);

// Get all conversations
router.get('/', conversationController.getConversations);

// Get messages for a conversation
router.get('/:id/messages', conversationController.getConversationMessages);

// Send a message
router.post('/send', conversationController.sendMessage);

// Mark conversation as read
router.post('/:id/read', conversationController.markAsRead);

export default router;

