import { Request, Response } from 'express';
import { UserService } from '../services/userService';
import { AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../types';
import logger from '../config/logger';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  // Get user profile
  getProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      throw error;
    }
  };

  // Update user profile
  updateProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const updateData = req.body;
      
      const updatedUser = await this.userService.updateUser(userId, updateData);
      
      res.json({
        success: true,
        data: updatedUser,
        message: 'Profile updated successfully'
      });
    } catch (error) {
      logger.error('Update profile error:', error);
      throw error;
    }
  };

  // Change password
  changePassword = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { currentPassword, newPassword } = req.body;
      
      await this.userService.changePassword(userId, currentPassword, newPassword);
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Change password error:', error);
      throw error;
    }
  };

  // Upload avatar
  uploadAvatar = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      
      if (!req.file) {
        throw new AppError('No file uploaded', 400, 'NO_FILE');
      }
      
      const avatarUrl = await this.userService.uploadAvatar(userId, req.file);
      
      res.json({
        success: true,
        data: { avatarUrl },
        message: 'Avatar uploaded successfully'
      });
    } catch (error) {
      logger.error('Upload avatar error:', error);
      throw error;
    }
  };

  // Get user statistics
  getUserStats = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const stats = await this.userService.getUserStatistics(userId);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Get user stats error:', error);
      throw error;
    }
  };

  // Delete user account
  deleteAccount = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { password } = req.body;
      
      await this.userService.deleteUserAccount(userId, password);
      
      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      logger.error('Delete account error:', error);
      throw error;
    }
  };

  // Admin: Get all users
  getAllUsers = async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 10, search, role } = req.query;
      
      const result = await this.userService.getAllUsers({
        page: Number(page),
        limit: Number(limit),
        search: search as string,
        role: role as string
      });
      
      res.json({
        success: true,
        data: result.users,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Get all users error:', error);
      throw error;
    }
  };

  // Admin: Get user by ID
  getUserById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = await this.userService.getUserById(id);
      
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Get user by ID error:', error);
      throw error;
    }
  };

  // Admin: Update user role
  updateUserRole = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      
      const updatedUser = await this.userService.updateUserRole(id, role);
      
      res.json({
        success: true,
        data: updatedUser,
        message: 'User role updated successfully'
      });
    } catch (error) {
      logger.error('Update user role error:', error);
      throw error;
    }
  };

  // Admin: Deactivate user
  deactivateUser = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      await this.userService.deactivateUser(id, reason);
      
      res.json({
        success: true,
        message: 'User deactivated successfully'
      });
    } catch (error) {
      logger.error('Deactivate user error:', error);
      throw error;
    }
  };
}
