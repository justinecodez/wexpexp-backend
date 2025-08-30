import express from 'express';
import { UserController } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { updateUserSchema, changePasswordSchema } from '../validation/userValidation';

const router = express.Router();
const userController = new UserController();

// Get user profile (authenticated)
router.get('/profile', authenticateToken, userController.getProfile);

// Update user profile (authenticated)
router.put('/profile', authenticateToken, validateBody(updateUserSchema), userController.updateProfile);

// Change password (authenticated)
router.put('/change-password', authenticateToken, validateBody(changePasswordSchema), userController.changePassword);

// Upload avatar (authenticated)
router.post('/upload-avatar', authenticateToken, userController.uploadAvatar);

// Get user statistics (authenticated)
router.get('/stats', authenticateToken, userController.getUserStats);

// Delete user account (authenticated)
router.delete('/account', authenticateToken, userController.deleteAccount);

// Admin routes (require admin role)
// Get all users (admin only)
router.get('/', authenticateToken, userController.getAllUsers);

// Get user by ID (admin only)  
router.get('/:id', authenticateToken, userController.getUserById);

// Update user role (admin only)
router.put('/:id/role', authenticateToken, userController.updateUserRole);

// Deactivate user (admin only)
router.put('/:id/deactivate', authenticateToken, userController.deactivateUser);

export default router;
