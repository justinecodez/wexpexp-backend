import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import database from '../config/database';
import { User, UserRole, BusinessType } from '../entities';
import config from '../config';
import { AppError } from '../middleware/errorHandler';
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  UserProfile,
  JWTPayload,
  RefreshTokenPayload,
} from '../types';

import logger from '../config/logger';

export class AuthService {
  /**
   * Register a new user
   */
  async register(userData: RegisterRequest): Promise<{ user: UserProfile; message: string }> {
    const { email, password, firstName, lastName, phone, companyName, businessType } = userData;
    const userRepository = database.getRepository(User);

    // Check if user already exists
    const existingUser = await userRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new AppError('User with this email already exists', 409, 'USER_EXISTS');
    }

    // Check if phone number is already used (if provided)
    if (phone) {
      const existingPhone = await userRepository.findOne({
        where: { phone: phone.trim() },
      });

      if (existingPhone) {
        throw new AppError('User with this phone number already exists', 409, 'PHONE_EXISTS');
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const newUser = new User();
    newUser.email = email.toLowerCase();
    newUser.passwordHash = passwordHash;
    newUser.firstName = firstName;
    newUser.lastName = lastName;
    newUser.phone = phone ? phone.trim() : null;
    newUser.companyName = companyName || null;
    newUser.businessType = (businessType as BusinessType) || null;

    const savedUser = await userRepository.save(newUser);

    // Return user without sensitive data
    const user: UserProfile = {
      id: savedUser.id,
      email: savedUser.email,
      firstName: savedUser.firstName,
      lastName: savedUser.lastName,
      phone: savedUser.phone || undefined,
      role: savedUser.role,
      isVerified: savedUser.isVerified,
      profileImage: savedUser.profileImage || undefined,
      companyName: savedUser.companyName || undefined,
      businessType: savedUser.businessType || undefined,
      createdAt: savedUser.createdAt,
    };

    logger.info(`New user registered: ${user.email}`);

    return {
      user,
      message: 'User registered successfully. Please verify your email address.',
    };
  }

  /**
   * Login user
   */
  async login(loginData: LoginRequest): Promise<AuthResponse> {
    const { email, password } = loginData;
    const userRepository = database.getRepository(User);

    // Find user
    const user = await userRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Check if user is verified
    if (!user.isVerified) {
      throw new AppError('Please verify your email address first', 401, 'EMAIL_NOT_VERIFIED');
    }

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email, user.role);

    // Save refresh token
    user.refreshToken = refreshToken;
    await userRepository.save(user);

    // Prepare user profile without sensitive data
    const userProfile: UserProfile = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || undefined,
      role: user.role,
      isVerified: user.isVerified,
      profileImage: user.profileImage || undefined,
      companyName: user.companyName || undefined,
      businessType: user.businessType || undefined,
      createdAt: user.createdAt,
    };

    logger.info(`User logged in: ${user.email}`);

    return {
      user: userProfile,
      accessToken,
      refreshToken,
      expiresIn: this.getTokenExpiration(config.jwtExpireTime),
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as RefreshTokenPayload;
      const userRepository = database.getRepository(User);

      // Find user and verify refresh token
      const user = await userRepository.findOne({
        where: { id: decoded.userId },
        select: ['id', 'email', 'role', 'refreshToken', 'isVerified'],
      });

      if (!user || user.refreshToken !== refreshToken) {
        throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }

      if (!user.isVerified) {
        throw new AppError('Email not verified', 401, 'EMAIL_NOT_VERIFIED');
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(user.id, user.email, user.role);

      return {
        accessToken,
        expiresIn: this.getTokenExpiration(config.jwtExpireTime),
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(userId: string): Promise<{ message: string }> {
    const userRepository = database.getRepository(User);

    await userRepository.update({ id: userId }, { refreshToken: null });

    logger.info(`User logged out: ${userId}`);

    return { message: 'Logged out successfully' };
  }

  /**
   * Generate password reset token
   */
  async forgotPassword(email: string): Promise<{ message: string; resetToken?: string }> {
    const userRepository = database.getRepository(User);
    const user = await userRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if email exists
      return {
        message: 'If an account with this email exists, a password reset link has been sent.',
      };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await userRepository.save(user);

    logger.info(`Password reset requested for: ${email}`);

    return {
      message: 'If an account with this email exists, a password reset link has been sent.',
      resetToken: config.nodeEnv === 'development' ? resetToken : undefined,
    };
  }

  /**
   * Reset password with token
   */
  async resetPassword(resetToken: string, newPassword: string): Promise<{ message: string }> {
    const userRepository = database.getRepository(User);
    const user = await userRepository
      .createQueryBuilder('user')
      .where('user.resetToken = :resetToken', { resetToken })
      .andWhere('user.resetTokenExpiry > :now', { now: new Date() })
      .getOne();

    if (!user) {
      throw new AppError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update user
    user.passwordHash = passwordHash;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    user.refreshToken = null; // Invalidate all sessions
    await userRepository.save(user);

    logger.info(`Password reset successful for user: ${user.id}`);

    return { message: 'Password reset successfully' };
  }

  /**
   * Verify email address
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    // In a real implementation, you would have an email verification token
    // For now, we'll use the reset token mechanism
    const userRepository = database.getRepository(User);
    const user = await userRepository.findOne({
      where: { resetToken: token },
    });

    if (!user) {
      throw new AppError('Invalid verification token', 400, 'INVALID_VERIFICATION_TOKEN');
    }

    user.isVerified = true;
    user.emailVerifiedAt = new Date();
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await userRepository.save(user);

    logger.info(`Email verified for user: ${user.id}`);

    return { message: 'Email verified successfully' };
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const userRepository = database.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: userId },
      select: ['id', 'passwordHash'],
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password and invalidate all sessions
    user.passwordHash = passwordHash;
    user.refreshToken = null;
    await userRepository.save(user);

    logger.info(`Password changed for user: ${userId}`);

    return { message: 'Password changed successfully' };
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    userId: string,
    email: string,
    role: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.generateAccessToken(userId, email, role);
    const refreshToken = this.generateRefreshToken(userId);

    return { accessToken, refreshToken };
  }

  /**
   * Generate access token
   */
  private generateAccessToken(userId: string, email: string, role: string): string {
    const payload: JWTPayload = {
      userId,
      email,
      role,
    };

    const options: SignOptions = {
      expiresIn: config.jwtExpireTime as any,
    };
    return jwt.sign(payload, config.jwtSecret, options);
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(userId: string): string {
    const payload: RefreshTokenPayload = {
      userId,
      tokenVersion: 1, // Can be used to invalidate tokens
    };

    const options: SignOptions = {
      expiresIn: config.jwtRefreshExpireTime as any,
    };
    return jwt.sign(payload, config.jwtRefreshSecret, options);
  }

  /**
   * Get token expiration time in seconds
   */
  private getTokenExpiration(expireTime: string): number {
    const timeUnit = expireTime.slice(-1);
    const timeValue = parseInt(expireTime.slice(0, -1));

    switch (timeUnit) {
      case 's':
        return timeValue;
      case 'm':
        return timeValue * 60;
      case 'h':
        return timeValue * 60 * 60;
      case 'd':
        return timeValue * 24 * 60 * 60;
      default:
        return 3600; // 1 hour default
    }
  }
}

export default new AuthService();
