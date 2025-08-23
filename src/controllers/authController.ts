import { Request, Response, NextFunction } from 'express';
import authService from '../services/authService';
import { ApiResponse, AuthenticatedRequest } from '../types';
import { catchAsync } from '../middleware/errorHandler';

export class AuthController {
  /**
   * Register a new user
   */
  register = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const result = await authService.register(req.body);

    const response: ApiResponse = {
      success: true,
      message: result.message,
      data: { user: result.user },
    };

    res.status(201).json(response);
  });

  /**
   * Login user
   */
  login = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const result = await authService.login(req.body);

    const response: ApiResponse = {
      success: true,
      message: 'Login successful',
      data: result,
    };

    res.status(200).json(response);
  });

  /**
   * Refresh access token
   */
  refreshToken = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required',
      });
    }

    const result = await authService.refreshToken(refreshToken);

    const response: ApiResponse = {
      success: true,
      message: 'Token refreshed successfully',
      data: result,
    };

    res.status(200).json(response);
  });

  /**
   * Logout user
   */
  logout = catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const result = await authService.logout(req.user.userId);

    const response: ApiResponse = {
      success: true,
      message: result.message,
    };

    res.status(200).json(response);
  });

  /**
   * Request password reset
   */
  forgotPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const result = await authService.forgotPassword(email);

    const response: ApiResponse = {
      success: true,
      message: result.message,
      data: result.resetToken ? { resetToken: result.resetToken } : undefined,
    };

    res.status(200).json(response);
  });

  /**
   * Reset password with token
   */
  resetPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and password are required',
      });
    }

    const result = await authService.resetPassword(token, password);

    const response: ApiResponse = {
      success: true,
      message: result.message,
    };

    res.status(200).json(response);
  });

  /**
   * Verify email address
   */
  verifyEmail = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required',
      });
    }

    const result = await authService.verifyEmail(token);

    const response: ApiResponse = {
      success: true,
      message: result.message,
    };

    res.status(200).json(response);
  });

  /**
   * Change password (authenticated user)
   */
  changePassword = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const { currentPassword, newPassword } = req.body as {
        currentPassword: string;
        newPassword: string;
      };

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password and new password are required',
        });
      }

      const result = await authService.changePassword(
        req.user.userId,
        currentPassword,
        newPassword
      );

      const response: ApiResponse = {
        success: true,
        message: result.message,
      };

      res.status(200).json(response);
    }
  );

  /**
   * Get current user profile
   */
  getProfile = catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // This would typically be handled by a user service
    // For now, we'll return the user data from the token
    const response: ApiResponse = {
      success: true,
      data: { user: req.user },
    };

    res.status(200).json(response);
  });

  /**
   * Check authentication status
   */
  checkAuth = catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const isAuthenticated = !!req.user;

    const response: ApiResponse = {
      success: true,
      data: {
        isAuthenticated,
        user: req.user || null,
      },
    };

    res.status(200).json(response);
  });
}

export default new AuthController();
