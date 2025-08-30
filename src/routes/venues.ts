import express from 'express';
import { VenueController } from '../controllers/venueController';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { createVenueBookingSchema } from '../validation/basicValidation';

const router = express.Router();
const venueController = new VenueController();

// Get all venues (public)
router.get('/', venueController.getAllVenues);

// Get venue by ID (public)
router.get('/:id', venueController.getVenueById);

// Get venues by location (public)
router.get('/location/:location', venueController.getVenuesByLocation);

// Get popular venues (public)
router.get('/popular', venueController.getPopularVenues);

// Check venue availability (public)
router.post('/:id/check-availability', venueController.checkVenueAvailability);

// Book venue (authenticated)
router.post('/book', authenticateToken, validateBody(createVenueBookingSchema), venueController.bookVenue);

// Get user venue bookings (authenticated)
router.get('/bookings', authenticateToken, venueController.getUserVenueBookings);

// Get venue booking by ID (authenticated)
router.get('/bookings/:id', authenticateToken, venueController.getVenueBookingById);

// Update venue booking (authenticated)
router.put('/bookings/:id', authenticateToken, venueController.updateVenueBooking);

// Cancel venue booking (authenticated)
router.delete('/bookings/:id', authenticateToken, venueController.cancelVenueBooking);

// Get venue types (public)
router.get('/types', venueController.getVenueTypes);

// Get venues by capacity range (public)
router.get('/capacity/:min/:max', venueController.getVenuesByCapacity);

// Get venue amenities (public)
router.get('/:id/amenities', venueController.getVenueAmenities);

export default router;
