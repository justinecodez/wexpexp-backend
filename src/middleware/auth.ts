import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import database from '../config/database';
import { User, Event, Booking } from '../entities';
import { AppError, catchAsync } from './errorHandler';
import { JWTPayload, AuthenticatedRequest } from '../types';
import config from '../config';
import logger from '../config/logger';

export const authenticate = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // 1) Getting token and check if it's there
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return next(
        new AppError('You are not logged in! Please log in to get access.', 401, 'NO_TOKEN')
      );
    }

    // 2) Verification token
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;
    } catch (error) {
      return next(new AppError('Invalid token. Please log in again!', 401, 'INVALID_TOKEN'));
    }

    // 3) Check if user still exists
    const userRepository = database.getRepository(User);
    const currentUser = await userRepository.findOne({
      where: { id: decoded.userId },
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'isVerified'],
    });

    if (!currentUser) {
      return next(
        new AppError(
          'The user belonging to this token does no longer exist.',
          401,
          'USER_NOT_FOUND'
        )
      );
    }

    // 4) Check if user is verified
    // if (!currentUser.isVerified) {
    //   return next(
    //     new AppError('Please verify your email address first.', 401, 'EMAIL_NOT_VERIFIED')
    //   );
    // }

    // Grant access to protected route
    req.user = decoded;
    next();
  }
);

export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('You are not logged in!', 401, 'NO_USER'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          'You do not have permission to perform this action',
          403,
          'INSUFFICIENT_PERMISSION'
        )
      );
    }

    next();
  };
};

export const optionalAuth = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Try to authenticate but don't throw error if no token
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer')) {
      token = authHeader.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;

        const userRepository = database.getRepository(User);
        const currentUser = await userRepository.findOne({
          where: { id: decoded.userId },
          select: ['id', 'email', 'firstName', 'lastName', 'role', 'isVerified'],
        });

        if (currentUser && currentUser.isVerified) {
          req.user = decoded;
        }
      } catch (error) {
        // Silently fail for optional auth
        logger.debug('Optional auth failed:', error);
      }
    }

    next();
  }
);

export const verifyTokenOwnership = (paramName: string = 'userId') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('You are not logged in!', 401, 'NO_USER'));
    }

    const resourceUserId = req.params[paramName] as string;

    // Admin can access all resources
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // User can only access their own resources
    if (req.user.userId !== resourceUserId) {
      return next(
        new AppError('You can only access your own resources', 403, 'RESOURCE_ACCESS_DENIED')
      );
    }

    next();
  };
};

export const verifyEventOwnership = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('You are not logged in!', 401, 'NO_USER'));
    }

    const eventId = (req.params.id || req.params.eventId) as string;

    if (!eventId) {
      return next(new AppError('Event ID is required', 400, 'MISSING_EVENT_ID'));
    }

    // Admin can access all events
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Check if event belongs to user
    const eventRepository = database.getRepository(Event);
    const event = await eventRepository.findOne({
      where: { id: eventId },
      select: ['userId'],
    });

    if (!event) {
      return next(new AppError('Event not found', 404, 'EVENT_NOT_FOUND'));
    }

    if (event.userId !== req.user.userId) {
      return next(new AppError('You can only access your own events', 403, 'EVENT_ACCESS_DENIED'));
    }

    next();
  }
);

export const verifyTourBookingOwnership = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('You are not logged in!', 401, 'NO_USER'));
    }

    const bookingId = (req.params.id || req.params.bookingId) as string;

    if (!bookingId) {
      return next(new AppError('Booking ID is required', 400, 'MISSING_BOOKING_ID'));
    }

    // Admin can access all bookings
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Check if tour booking belongs to user
    const bookingRepository = database.getRepository(Booking);
    const booking = await bookingRepository.findOne({
      where: { id: bookingId },
      select: ['userId'],
    });

    if (!booking) {
      return next(new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND'));
    }

    if (booking.userId !== req.user.userId) {
      return next(
        new AppError('You can only access your own bookings', 403, 'BOOKING_ACCESS_DENIED')
      );
    }

    next();
  }
);

export const verifyVehicleBookingOwnership = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('You are not logged in!', 401, 'NO_USER'));
    }

    const bookingId = (req.params.id || req.params.bookingId) as string;

    if (!bookingId) {
      return next(new AppError('Booking ID is required', 400, 'MISSING_BOOKING_ID'));
    }

    // Admin can access all bookings
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Check if vehicle booking belongs to user
    const bookingRepository = database.getRepository(Booking);
    const booking = await bookingRepository.findOne({
      where: { id: bookingId },
      select: ['userId'],
    });

    if (!booking) {
      return next(new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND'));
    }

    if (booking.userId !== req.user.userId) {
      return next(
        new AppError('You can only access your own bookings', 403, 'BOOKING_ACCESS_DENIED')
      );
    }

    next();
  }
);

export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return next(new AppError('API key is required', 401, 'MISSING_API_KEY'));
  }

  // In production, you would validate against stored API keys
  // For now, just check if it matches a configured key
  const validApiKey = process.env.API_KEY;

  if (!validApiKey || apiKey !== validApiKey) {
    return next(new AppError('Invalid API key', 401, 'INVALID_API_KEY'));
  }

  next();
};
