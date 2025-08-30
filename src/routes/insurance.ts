import express from 'express';
import { InsuranceController } from '../controllers/insuranceController';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { createInsurancePolicySchema, updateInsurancePolicySchema } from '../validation/basicValidation';

const router = express.Router();
const insuranceController = new InsuranceController();

// Get all insurance plans (public)
router.get('/plans', insuranceController.getAllPlans);

// Get insurance plan by ID (public)
router.get('/plans/:id', insuranceController.getPlanById);

// Get insurance plans by category (public)
router.get('/plans/category/:category', insuranceController.getPlansByCategory);

// Calculate insurance premium (public)
router.post('/calculate-premium', insuranceController.calculatePremium);

// Create insurance policy (authenticated)
router.post('/policy', authenticateToken, validateBody(createInsurancePolicySchema), insuranceController.createPolicy);

// Get user insurance policies (authenticated)
router.get('/policies', authenticateToken, insuranceController.getUserPolicies);

// Get insurance policy by ID (authenticated)
router.get('/policies/:id', authenticateToken, insuranceController.getPolicyById);

// Update insurance policy (authenticated)
router.put('/policies/:id', authenticateToken, validateBody(updateInsurancePolicySchema), insuranceController.updatePolicy);

// Cancel insurance policy (authenticated)
router.delete('/policies/:id', authenticateToken, insuranceController.cancelPolicy);

// Get insurance categories (public)
router.get('/categories', insuranceController.getInsuranceCategories);

// Submit insurance claim (authenticated)
router.post('/policies/:id/claim', authenticateToken, insuranceController.submitClaim);

// Get policy claims (authenticated)
router.get('/policies/:id/claims', authenticateToken, insuranceController.getPolicyClaims);

// Upload policy documents (authenticated)
router.post('/policies/:id/documents', authenticateToken, insuranceController.uploadPolicyDocuments);

// Get insurance terms (public)
router.get('/terms/:planId', insuranceController.getInsuranceTerms);

export default router;
