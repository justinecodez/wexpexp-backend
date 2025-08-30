import express from 'express';
import { AccommodationController } from '../controllers/accommodationController';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { accommodationValidation } from '../validation/accommodationValidation';

const router = express.Router();
const accommodationController = new AccommodationController();

// Public routes
router.get('/popular', accommodationController.getPopularAccommodations);
router.get('/search', accommodationController.searchAccommodations);
router.get('/locations', accommodationController.getAvailableLocations);
router.get('/:id', accommodationController.getAccommodation);

// Protected routes
router.use(authenticate);

router.post(
  '/book',
  validateBody(accommodationValidation.createBooking),
  accommodationController.bookAccommodation
);

router.get('/bookings/user', accommodationController.getUserBookings);
router.put('/bookings/:id', accommodationController.updateBooking);
router.delete('/bookings/:id', accommodationController.cancelBooking);

// Accommodation management (admin/provider routes)
router.post(
  '/',
  validateBody(accommodationValidation.create),
  accommodationController.createAccommodation
);

router.put(
  '/:id',
  validateBody(accommodationValidation.update),
  accommodationController.updateAccommodation
);

router.delete('/:id', accommodationController.deleteAccommodation);
router.post('/:id/availability', accommodationController.updateAvailability);

export default router;
