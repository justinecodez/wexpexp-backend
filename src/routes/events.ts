import { Router } from 'express';
import eventController from '../controllers/eventController';
import { authenticate, optionalAuth, verifyEventOwnership } from '../middleware/auth';
import { validateBody, validateQuery, validateParams } from '../middleware/validation';
import {
  createEventSchema,
  updateEventSchema,
  eventFilterSchema,
  paginationSchema,
  idParamSchema
} from '../utils/validation';

const router = Router();

/**
 * @route   POST /api/events
 * @desc    Create a new event
 * @access  Private
 */
router.post('/',
  authenticate,
  validateBody(createEventSchema),
  eventController.createEvent
);

/**
 * @route   GET /api/events
 * @desc    Get user events with filtering and pagination
 * @access  Private
 */
router.get('/',
  authenticate,
  validateQuery(eventFilterSchema.merge(paginationSchema)),
  eventController.getUserEvents
);

/**
 * @route   GET /api/events/public
 * @desc    Get public events
 * @access  Public
 */
router.get('/public',
  validateQuery(eventFilterSchema.merge(paginationSchema)),
  eventController.getPublicEvents
);

/**
 * @route   GET /api/events/stats
 * @desc    Get event statistics for dashboard
 * @access  Private
 */
router.get('/stats',
  authenticate,
  eventController.getEventStats
);

/**
 * @route   GET /api/events/:id
 * @desc    Get event by ID
 * @access  Public/Private (optional auth)
 */
router.get('/:id',
  validateParams(idParamSchema),
  optionalAuth,
  eventController.getEventById
);

/**
 * @route   PUT /api/events/:id
 * @desc    Update event
 * @access  Private (owner only)
 */
router.put('/:id',
  validateParams(idParamSchema),
  authenticate,
  verifyEventOwnership,
  validateBody(updateEventSchema),
  eventController.updateEvent
);

/**
 * @route   DELETE /api/events/:id
 * @desc    Delete event
 * @access  Private (owner only)
 */
router.delete('/:id',
  validateParams(idParamSchema),
  authenticate,
  verifyEventOwnership,
  eventController.deleteEvent
);

/**
 * @route   POST /api/events/:id/duplicate
 * @desc    Duplicate event
 * @access  Private (owner only)
 */
router.post('/:id/duplicate',
  validateParams(idParamSchema),
  authenticate,
  verifyEventOwnership,
  eventController.duplicateEvent
);

/**
 * @route   GET /api/events/:id/analytics
 * @desc    Get event analytics and reports
 * @access  Private (owner only)
 */
router.get('/:id/analytics',
  validateParams(idParamSchema),
  authenticate,
  verifyEventOwnership,
  eventController.getEventAnalytics
);

/**
 * @route   PATCH /api/events/:id/status
 * @desc    Update event status
 * @access  Private (owner only)
 */
router.patch('/:id/status',
  validateParams(idParamSchema),
  authenticate,
  verifyEventOwnership,
  eventController.updateEventStatus
);

/**
 * @route   GET /api/events/:id/upload-url
 * @desc    Get presigned URL for direct upload
 * @access  Private (owner only)
 */
router.get('/:id/upload-url',
  validateParams(idParamSchema),
  authenticate,
  eventController.getUploadUrl
);

/**
 * @route   POST /api/events/:id/template
 * @desc    Save template configuration
 * @access  Private (owner only)
 */
router.post('/:id/template',
  validateParams(idParamSchema),
  authenticate,
  eventController.saveTemplateConfig
);

/**
 * @route   POST /api/events/:id/generate
 * @desc    Trigger invitation generation
 * @access  Private (owner only)
 */
router.post('/:id/generate',
  validateParams(idParamSchema),
  authenticate,
  eventController.triggerGeneration
);

export default router;
