import express from 'express';
import { ECardController } from '../controllers/ecardController';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { createECardSchema, updateECardSchema } from '../validation/basicValidation';

const router = express.Router();
const ecardController = new ECardController();

// Get all e-cards for user (authenticated)
router.get('/', authenticateToken, ecardController.getUserECards);

// Get e-card by ID (authenticated)
router.get('/:id', authenticateToken, ecardController.getECardById);

// Create new e-card (authenticated)
router.post('/', authenticateToken, validateBody(createECardSchema), ecardController.createECard);

// Update e-card (authenticated)
router.put('/:id', authenticateToken, validateBody(updateECardSchema), ecardController.updateECard);

// Delete e-card (authenticated)
router.delete('/:id', authenticateToken, ecardController.deleteECard);

// Preview e-card (public)
router.get('/:id/preview', ecardController.previewECard);

// Download e-card as image (public)
router.get('/:id/download', ecardController.downloadECard);

// Get e-cards by event (authenticated)
router.get('/event/:eventId', authenticateToken, ecardController.getECardsByEvent);

// Duplicate e-card (authenticated)
router.post('/:id/duplicate', authenticateToken, ecardController.duplicateECard);

// Upload e-card image (authenticated)
router.post('/:id/upload-image', authenticateToken, ecardController.uploadECardImage);

export default router;
