import { Router } from 'express';
import { z } from 'zod';
import templateController from '../controllers/templateController';
import { authenticate } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';
import { idParamSchema } from '../utils/validation';

const router = Router();

/**
 * @route   POST /api/templates
 * @desc    Create event template
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  validateBody(
    z.object({
      eventId: z.string().uuid(),
      name: z.string().min(1).max(100),
    })
  ),
  templateController.createTemplate
);

/**
 * @route   POST /api/templates/:templateId/events
 * @desc    Create event from template
 * @access  Private
 */
router.post(
  '/:templateId/events',
  authenticate,
  validateParams(idParamSchema.extend({ templateId: idParamSchema.shape.id })),
  validateBody(
    z.object({
      title: z.string().min(1).max(200),
      eventDate: z.string().refine(date => !isNaN(Date.parse(date)), {
        message: 'Invalid date format',
      }),
      venueName: z.string().optional(),
      venueAddress: z.string().optional(),
      venueCity: z.string().optional(),
    })
  ),
  templateController.createEventFromTemplate
);

/**
 * @route   GET /api/templates
 * @desc    Get user's templates
 * @access  Private
 */
router.get('/', authenticate, templateController.getUserTemplates);

/**
 * @route   PUT /api/templates/:templateId
 * @desc    Update template
 * @access  Private
 */
router.put(
  '/:templateId',
  authenticate,
  validateParams(idParamSchema.extend({ templateId: idParamSchema.shape.id })),
  validateBody(
    z.object({
      name: z.string().min(1).max(100).optional(),
      settings: z
        .object({
          includeInvitations: z.boolean().optional(),
          includeECards: z.boolean().optional(),
          includeBudget: z.boolean().optional(),
          includeVenue: z.boolean().optional(),
        })
        .optional(),
    })
  ),
  templateController.updateTemplate
);

/**
 * @route   DELETE /api/templates/:templateId
 * @desc    Delete template
 * @access  Private
 */
router.delete(
  '/:templateId',
  authenticate,
  validateParams(idParamSchema.extend({ templateId: idParamSchema.shape.id })),
  templateController.deleteTemplate
);

export default router;
