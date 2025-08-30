import { Router } from 'express';
import { z } from 'zod';
import budgetController from '../controllers/budgetController';
import { authenticate } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';
import { idParamSchema } from '../utils/validation';

const router = Router();

/**
 * @route   PUT /api/budgets/:eventId
 * @desc    Create or update event budget
 * @access  Private
 */
router.put(
  '/:eventId',
  authenticate,
  validateParams(idParamSchema.extend({ eventId: idParamSchema.shape.id })),
  validateBody(
    z.object({
      amount: z.number().positive(),
      currency: z.string().default('TZS'),
    })
  ),
  budgetController.createOrUpdateBudget
);

/**
 * @route   POST /api/budgets/:eventId/items
 * @desc    Add budget item
 * @access  Private
 */
router.post(
  '/:eventId/items',
  authenticate,
  validateParams(idParamSchema.extend({ eventId: idParamSchema.shape.id })),
  validateBody(
    z.object({
      category: z.string().min(1),
      description: z.string().min(1),
      amount: z.number().positive(),
      dueDate: z
        .string()
        .refine(date => !isNaN(Date.parse(date)), {
          message: 'Invalid date format',
        })
        .optional(),
      status: z.enum(['PLANNED', 'PAID', 'CANCELLED']),
      paymentMethod: z.string().optional(),
      attachments: z.array(z.string()).optional(),
    })
  ),
  budgetController.addBudgetItem
);

/**
 * @route   PUT /api/budgets/:eventId/items/:itemId
 * @desc    Update budget item
 * @access  Private
 */
router.put(
  '/:eventId/items/:itemId',
  authenticate,
  validateParams(
    idParamSchema.extend({
      eventId: idParamSchema.shape.id,
      itemId: idParamSchema.shape.id,
    })
  ),
  validateBody(
    z.object({
      category: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      amount: z.number().positive().optional(),
      dueDate: z
        .string()
        .refine(date => !isNaN(Date.parse(date)), {
          message: 'Invalid date format',
        })
        .optional(),
      status: z.enum(['PLANNED', 'PAID', 'CANCELLED']).optional(),
      paymentMethod: z.string().optional(),
      attachments: z.array(z.string()).optional(),
    })
  ),
  budgetController.updateBudgetItem
);

/**
 * @route   DELETE /api/budgets/:eventId/items/:itemId
 * @desc    Delete budget item
 * @access  Private
 */
router.delete(
  '/:eventId/items/:itemId',
  authenticate,
  validateParams(
    idParamSchema.extend({
      eventId: idParamSchema.shape.id,
      itemId: idParamSchema.shape.id,
    })
  ),
  budgetController.deleteBudgetItem
);

/**
 * @route   GET /api/budgets/:eventId/summary
 * @desc    Get budget summary
 * @access  Private
 */
router.get(
  '/:eventId/summary',
  authenticate,
  validateParams(idParamSchema.extend({ eventId: idParamSchema.shape.id })),
  budgetController.getBudgetSummary
);

export default router;
