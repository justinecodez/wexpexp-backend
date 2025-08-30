import { Router } from 'express';
import { z } from 'zod';
import vehicleController from '../controllers/vehicleController';
import { authenticate, verifyTourBookingOwnership as verifyBookingOwnership } from '../middleware/auth';
import { validateBody, validateQuery, validateParams } from '../middleware/validation';
import {
  serviceFilterSchema,
  bookingSchema,
  paginationSchema,
  idParamSchema,
} from '../utils/validation';

const router = Router();

/**
 * @route   GET /api/vehicles
 * @desc    Get all vehicles with filtering and pagination
 * @access  Public
 */
router.get(
  '/',
  validateQuery(
    serviceFilterSchema
      .extend({
        vehicleType: z.enum(['SEDAN', 'SUV', 'VAN', 'BUS', 'PICKUP', 'MOTORCYCLE']).optional(),
        withDriver: z
          .string()
          .transform(val => val === 'true')
          .optional(),
        availability: z
          .string()
          .transform(val => val !== 'false')
          .optional(),
      })
      .merge(paginationSchema)
  ),
  vehicleController.getVehicles
);

/**
 * @route   GET /api/vehicles/types
 * @desc    Get vehicle types with counts
 * @access  Public
 */
router.get('/types', vehicleController.getVehicleTypes);

/**
 * @route   GET /api/vehicles/location/:location
 * @desc    Get vehicles by location
 * @access  Public
 */
router.get(
  '/location/:location',
  validateParams(
    z.object({
      location: z.enum([
        'DAR_ES_SALAAM',
        'ARUSHA',
        'ZANZIBAR',
        'MWANZA',
        'DODOMA',
        'TANGA',
        'MOROGORO',
        'MBEYA',
        'IRINGA',
        'KILIMANJARO',
      ]),
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
  vehicleController.getVehiclesByLocation
);

/**
 * @route   GET /api/vehicles/bookings
 * @desc    Get user vehicle bookings
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
  vehicleController.getUserBookings
);

/**
 * @route   GET /api/vehicles/:id
 * @desc    Get vehicle by ID
 * @access  Public
 */
router.get('/:id', validateParams(idParamSchema), vehicleController.getVehicleById);

/**
 * @route   POST /api/vehicles/:id/check-availability
 * @desc    Check vehicle availability for dates
 * @access  Public
 */
router.post(
  '/:id/check-availability',
  validateParams(idParamSchema),
  validateBody(
    z.object({
      startDate: z.string().refine(date => !isNaN(Date.parse(date)), {
        message: 'Invalid start date format',
      }),
      endDate: z.string().refine(date => !isNaN(Date.parse(date)), {
        message: 'Invalid end date format',
      }),
    })
  ),
  vehicleController.checkAvailability
);

/**
 * @route   POST /api/vehicles/book
 * @desc    Book a vehicle
 * @access  Private
 */
router.post(
  '/book',
  authenticate,
  validateBody(
    bookingSchema.extend({
      serviceType: z.literal('VEHICLE'),
      startDate: z.string().refine(date => !isNaN(Date.parse(date)), {
        message: 'Invalid start date format',
      }),
      endDate: z.string().refine(date => !isNaN(Date.parse(date)), {
        message: 'Invalid end date format',
      }),
    })
  ),
  vehicleController.bookVehicle
);

/**
 * @route   PUT /api/vehicles/bookings/:id
 * @desc    Update vehicle booking
 * @access  Private (booking owner)
 */
router.put(
  '/bookings/:id',
  authenticate,
  validateParams(idParamSchema),
  verifyBookingOwnership,
  validateBody(
    z.object({
      status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']).optional(),
      paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(),
      specialRequests: z.string().optional(),
    })
  ),
  vehicleController.updateBooking
);

/**
 * @route   DELETE /api/vehicles/bookings/:id
 * @desc    Cancel vehicle booking
 * @access  Private (booking owner)
 */
router.delete(
  '/bookings/:id',
  authenticate,
  validateParams(idParamSchema),
  verifyBookingOwnership,
  vehicleController.cancelBooking
);

export default router;
