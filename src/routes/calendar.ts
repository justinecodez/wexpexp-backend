import { Router } from 'express';
import { z } from 'zod';
import calendarController from '../controllers/calendarController';
import { authenticate } from '../middleware/auth';
import { validateParams, validateQuery } from '../middleware/validation';
import { idParamSchema } from '../utils/validation';

const router = Router();

/**
 * @route   GET /api/calendar/ical
 * @desc    Get iCal feed for user's events
 * @access  Private
 */
router.get('/ical', authenticate, calendarController.generateICalFeed);

/**
 * @route   GET /api/calendar/google/auth
 * @desc    Get Google Calendar auth URL
 * @access  Private
 */
router.get('/google/auth', authenticate, calendarController.getGoogleAuthUrl);

/**
 * @route   GET /api/calendar/google/callback
 * @desc    Handle Google Calendar OAuth callback
 * @access  Public
 */
router.get(
  '/google/callback',
  validateQuery(
    z.object({
      code: z.string(),
      state: z.string(),
    })
  ),
  calendarController.handleGoogleCallback
);

/**
 * @route   POST /api/calendar/events/:eventId/sync
 * @desc    Sync event with Google Calendar
 * @access  Private
 */
router.post(
  '/events/:eventId/sync',
  authenticate,
  validateParams(idParamSchema.extend({ eventId: idParamSchema.shape.id })),
  calendarController.syncWithGoogleCalendar
);

export default router;
