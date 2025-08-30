import express from 'express';
import { DecorationController } from '../controllers/decorationController';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { createDecorationBookingSchema } from '../validation/basicValidation';

const router = express.Router();
const decorationController = new DecorationController();

// Get all decoration packages (public)
router.get('/', decorationController.getAllDecorations);

// Get decoration by ID (public)
router.get('/:id', decorationController.getDecorationById);

// Get decorations by theme (public)
router.get('/theme/:theme', decorationController.getDecorationsByTheme);

// Get popular decorations (public)
router.get('/popular', decorationController.getPopularDecorations);

// Get decoration categories (public)
router.get('/categories', decorationController.getDecorationCategories);

// Book decoration service (authenticated)
router.post('/book', authenticateToken, validateBody(createDecorationBookingSchema), decorationController.bookDecoration);

// Get user decoration bookings (authenticated)
router.get('/bookings', authenticateToken, decorationController.getUserDecorationBookings);

// Get decoration booking by ID (authenticated)
router.get('/bookings/:id', authenticateToken, decorationController.getDecorationBookingById);

// Update decoration booking (authenticated)
router.put('/bookings/:id', authenticateToken, decorationController.updateDecorationBooking);

// Cancel decoration booking (authenticated)
router.delete('/bookings/:id', authenticateToken, decorationController.cancelDecorationBooking);

// Get decorations by price range (public)
router.get('/price/:min/:max', decorationController.getDecorationsByPriceRange);

// Get decoration themes (public)
router.get('/themes', decorationController.getDecorationThemes);

// Get decoration add-ons (public)
router.get('/:id/addons', decorationController.getDecorationAddOns);

// Request custom decoration quote (authenticated)
router.post('/custom-quote', authenticateToken, decorationController.requestCustomQuote);

export default router;
