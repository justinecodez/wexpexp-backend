import { Request, Response, NextFunction } from 'express';
import tourService from '../services/tourService';
import { ApiResponse, AuthenticatedRequest, BookingRequest } from '../types';
import { catchAsync } from '../middleware/errorHandler';

export class TourController {
  /**
   * Get all tours with filtering and pagination
   */
  getTours = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const filters = {
      location: req.query.location as string,
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
      category: req.query.category as string,
      search: req.query.search as string,
    };

    const pagination = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      sortBy: (req.query.sortBy as string) || 'createdAt',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
    };

    const result = await tourService.getTours(filters, pagination);

    const response: ApiResponse = {
      success: true,
      data: result.tours,
      pagination: result.pagination,
    };

    res.status(200).json(response);
  });

  /**
   * Get tour by ID
   */
  getTourById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const tour = await tourService.getTourById(id);

    const response: ApiResponse = {
      success: true,
      data: { tour },
    };

    res.status(200).json(response);
  });

  /**
   * Book a tour
   */
  bookTour = catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const booking = await tourService.bookTour(req.user.userId, req.body as BookingRequest);

    const response: ApiResponse = {
      success: true,
      message: 'Tour booked successfully',
      data: { booking },
    };

    res.status(201).json(response);
  });

  /**
   * Get user tour bookings
   */
  getUserBookings = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sortBy: (req.query.sortBy as string) || 'createdAt',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const filters = {
        status: req.query.status as string,
      };

      const result = await tourService.getUserBookings(req.user.userId, pagination, filters);

      const response: ApiResponse = {
        success: true,
        data: result.bookings,
        pagination: result.pagination,
      };

      res.status(200).json(response);
    }
  );

  /**
   * Update booking
   */
  updateBooking = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const { id } = req.params;
      const booking = await tourService.updateBooking(
        id,
        req.user.userId,
        req.body as { status?: string; paymentStatus?: string; specialRequests?: string }
      );

      const response: ApiResponse = {
        success: true,
        message: 'Booking updated successfully',
        data: { booking },
      };

      res.status(200).json(response);
    }
  );

  /**
   * Cancel booking
   */
  cancelBooking = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const { id } = req.params;
      const result = await tourService.cancelBooking(id, req.user.userId);

      const response: ApiResponse = {
        success: true,
        message: result.message,
      };

      res.status(200).json(response);
    }
  );

  /**
   * Get popular tours
   */
  getPopularTours = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const tours = await tourService.getPopularTours(limit);

    const response: ApiResponse = {
      success: true,
      data: { tours },
    };

    res.status(200).json(response);
  });

  /**
   * Get tours by category
   */
  getToursByCategory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { category } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const tours = await tourService.getToursByCategory(category, limit);

    const response: ApiResponse = {
      success: true,
      data: { tours },
    };

    res.status(200).json(response);
  });
}

export default new TourController();
