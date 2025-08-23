import { Router } from 'express';
import { z } from 'zod';
import tourController from '../controllers/tourController';
import { authenticate, optionalAuth, verifyTourBookingOwnership } from '../middleware/auth';
import { validateBody, validateQuery, validateParams } from '../middleware/validation';
import {
  serviceFilterSchema,
  bookingSchema,
  paginationSchema,
  idParamSchema,
} from '../utils/validation';

const router = Router();

/**
 * @route   GET /api/tours
 * @desc    Get all tours with filtering and pagination
 * @access  Public
 */
router.get(
  '/',
  validateQuery(
    serviceFilterSchema
      .extend({
        category: z
          .enum(['SAFARI', 'CULTURAL', 'ADVENTURE', 'CITY_TOUR', 'BEACH', 'HISTORICAL'])
          .optional(),
      })
      .merge(paginationSchema)
  ),
  tourController.getTours
);

/**
 * @route   GET /api/tours/popular
 * @desc    Get popular tours
 * @access  Public
 */
router.get(
  '/popular',
  validateQuery(
    z.object({
      limit: z
        .string()
        .transform(val => parseInt(val, 10))
        .optional(),
    })
  ),
  tourController.getPopularTours
);

/**
 * @route   GET /api/tours/category/:category
 * @desc    Get tours by category
 * @access  Public
 */
router.get(
  '/category/:category',
  validateParams(
    z.object({
      category: z.enum(['SAFARI', 'CULTURAL', 'ADVENTURE', 'CITY_TOUR', 'BEACH', 'HISTORICAL']),
    })
  ),
  validateQuery(
    z.object({
      limit: z
        .string()
        .transform(val => parseInt(val, 10))
        .optional(),
    })
  ),
  tourController.getToursByCategory
);

/**
 * @route   GET /api/tours/bookings
 * @desc    Get user tour bookings
 * @access  Private
 */
router.get(
  '/bookings',
  authenticate,
  validateQuery(
    paginationSchema.extend({
      status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']).optional(),
    })
  ),
  tourController.getUserBookings
);

/**
 * @route   GET /api/tours/:id
 * @desc    Get tour by ID
 * @access  Public
 */
router.get('/:id', validateParams(idParamSchema), tourController.getTourById);

/**
 * @route   POST /api/tours/book
 * @desc    Book a tour
 * @access  Private
 */
router.post(
  '/book',
  authenticate,
  validateBody(
    bookingSchema.extend({
      serviceType: z.literal('TOUR'),
    })
  ),
  tourController.bookTour
);

/**
 * @route   PUT /api/tours/bookings/:id
 * @desc    Update tour booking
 * @access  Private (booking owner)
 */
router.put(
  '/bookings/:id',
  authenticate,
  validateParams(idParamSchema),
  verifyTourBookingOwnership,
  validateBody(
    z.object({
      status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']).optional(),
      paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(),
      specialRequests: z.string().optional(),
    })
  ),
  tourController.updateBooking
);

/**
 * @route   DELETE /api/tours/bookings/:id
 * @desc    Cancel tour booking
 * @access  Private (booking owner)
 */
router.delete(
  '/bookings/:id',
  authenticate,
  validateParams(idParamSchema),
  verifyTourBookingOwnership,
  tourController.cancelBooking
);

export default router;
