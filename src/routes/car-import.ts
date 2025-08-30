import express from 'express';
import { CarImportController } from '../controllers/carImportController';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { createCarImportInquirySchema, updateCarImportInquirySchema } from '../validation/basicValidation';

const router = express.Router();
const carImportController = new CarImportController();

// Create car import inquiry (authenticated)
router.post('/inquiry', authenticateToken, validateBody(createCarImportInquirySchema), carImportController.createInquiry);

// Get user car import inquiries (authenticated)
router.get('/inquiries', authenticateToken, carImportController.getUserInquiries);

// Get car import inquiry by ID (authenticated)
router.get('/inquiries/:id', authenticateToken, carImportController.getInquiryById);

// Update car import inquiry (authenticated)
router.put('/inquiries/:id', authenticateToken, validateBody(updateCarImportInquirySchema), carImportController.updateInquiry);

// Delete car import inquiry (authenticated)
router.delete('/inquiries/:id', authenticateToken, carImportController.deleteInquiry);

// Get import process information (public)
router.get('/process-info', carImportController.getImportProcessInfo);

// Get supported countries (public)
router.get('/countries', carImportController.getSupportedCountries);

// Calculate import cost estimate (public)
router.post('/cost-estimate', carImportController.calculateImportCost);

// Get required documents (public)
router.get('/documents', carImportController.getRequiredDocuments);

// Upload inquiry documents (authenticated)
router.post('/inquiries/:id/documents', authenticateToken, carImportController.uploadDocuments);

// Get import regulations (public)
router.get('/regulations', carImportController.getImportRegulations);

// Get popular car models for import (public)
router.get('/popular-models', carImportController.getPopularModels);

// Request consultation (authenticated)
router.post('/consultation', authenticateToken, carImportController.requestConsultation);

export default router;
