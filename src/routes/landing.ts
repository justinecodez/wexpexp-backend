import express from 'express';
import { LandingController } from '../controllers/landingController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { updateLandingContentSchema } from '../validation/basicValidation';

const router = express.Router();
const landingController = new LandingController();

// Get landing page content (public)
router.get('/content', landingController.getLandingContent);

// Get landing page sections (public)
router.get('/sections', landingController.getLandingSections);

// Get hero section content (public)
router.get('/hero', landingController.getHeroSection);

// Get features section content (public)
router.get('/features', landingController.getFeaturesSection);

// Get testimonials (public)
router.get('/testimonials', landingController.getTestimonials);

// Get pricing information (public)
router.get('/pricing', landingController.getPricing);

// Get FAQ content (public)
router.get('/faq', landingController.getFAQ);

// Get contact information (public)
router.get('/contact', landingController.getContactInfo);

// Submit contact form (public)
router.post('/contact', landingController.submitContactForm);

// Subscribe to newsletter (public)
router.post('/newsletter', landingController.subscribeNewsletter);

// Admin routes for content management
// Update landing content (admin only)
router.put('/content', authenticateToken, requireAdmin, validateBody(updateLandingContentSchema), landingController.updateLandingContent);

// Update hero section (admin only)
router.put('/hero', authenticateToken, requireAdmin, landingController.updateHeroSection);

// Update features section (admin only)
router.put('/features', authenticateToken, requireAdmin, landingController.updateFeaturesSection);

// Manage testimonials (admin only)
router.post('/testimonials', authenticateToken, requireAdmin, landingController.addTestimonial);
router.put('/testimonials/:id', authenticateToken, requireAdmin, landingController.updateTestimonial);
router.delete('/testimonials/:id', authenticateToken, requireAdmin, landingController.deleteTestimonial);

// Update pricing (admin only)
router.put('/pricing', authenticateToken, requireAdmin, landingController.updatePricing);

// Manage FAQ (admin only)
router.post('/faq', authenticateToken, requireAdmin, landingController.addFAQItem);
router.put('/faq/:id', authenticateToken, requireAdmin, landingController.updateFAQItem);
router.delete('/faq/:id', authenticateToken, requireAdmin, landingController.deleteFAQItem);

// Upload landing page images (admin only)
router.post('/upload-image', authenticateToken, requireAdmin, landingController.uploadLandingImage);

export default router;
