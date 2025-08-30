import { Router } from 'express';
import { z } from 'zod';
import draftController from '../controllers/draftController';
import { authenticate } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';
import { idParamSchema, createEventSchema } from '../utils/validation';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   GET /api/drafts
 * @desc    Get all drafts for the user
 * @access  Private
 */
router.get('/', draftController.getUserDrafts);

/**
 * @route   GET /api/drafts/:draftId
 * @desc    Get specific draft
 * @access  Private
 */
router.get(
  '/:draftId',
  validateParams(idParamSchema.extend({ draftId: idParamSchema.shape.id })),
  draftController.getDraft
);

/**
 * @route   POST /api/drafts
 * @desc    Create new draft
 * @access  Private
 */
router.post(
  '/',
  validateBody(createEventSchema.partial()),
  draftController.saveDraft
);

/**
 * @route   PUT /api/drafts/:draftId
 * @desc    Update draft
 * @access  Private
 */
router.put(
  '/:draftId',
  validateParams(idParamSchema.extend({ draftId: idParamSchema.shape.id })),
  validateBody(createEventSchema.partial()),
  draftController.saveDraft
);

/**
 * @route   DELETE /api/drafts/:draftId
 * @desc    Delete draft
 * @access  Private
 */
router.delete(
  '/:draftId',
  validateParams(idParamSchema.extend({ draftId: idParamSchema.shape.id })),
  draftController.deleteDraft
);

/**
 * @route   POST /api/drafts/:draftId/publish
 * @desc    Publish draft as active event
 * @access  Private
 */
router.post(
  '/:draftId/publish',
  validateParams(idParamSchema.extend({ draftId: idParamSchema.shape.id })),
  draftController.publishDraft
);

export default router;
