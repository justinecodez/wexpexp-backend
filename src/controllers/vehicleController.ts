import { Request, Response, NextFunction } from 'express';
import vehicleService from '../services/vehicleService';
import { ApiResponse, AuthenticatedRequest, BookingRequest } from '../types';
import { catchAsync } from '../middleware/errorHandler';

export class VehicleController {
  /**
   * Get all vehicles with filtering and pagination
   */
  getVehicles = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const filters = {
      location: req.query.location as string,
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
      vehicleType: req.query.vehicleType as string,
      withDriver: req.query.withDriver ? req.query.withDriver === 'true' : undefined,
      availability: req.query.availability !== 'false',
      search: req.query.search as string,
    };

    const pagination = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      sortBy: (req.query.sortBy as string) || 'dailyRateTzs',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'asc',
    };

    const result = await vehicleService.getVehicles(filters, pagination);

    const response: ApiResponse = {
      success: true,
      data: result.vehicles,
      pagination: result.pagination,
    };

    res.status(200).json(response);
  });

  /**
   * Get vehicle by ID
   */
  getVehicleById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const vehicle = await vehicleService.getVehicleById(id);

    const response: ApiResponse = {
      success: true,
      data: { vehicle },
    };

    res.status(200).json(response);
  });

  /**
   * Check vehicle availability
   */
  checkAvailability = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required',
      });
    }

    const result = await vehicleService.checkAvailability(id, startDate, endDate);

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  });

  /**
   * Book a vehicle
   */
  bookVehicle = catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const booking = await vehicleService.bookVehicle(req.user.userId, req.body as BookingRequest);

    const response: ApiResponse = {
      success: true,
      message: 'Vehicle booked successfully',
      data: { booking },
    };

    res.status(201).json(response);
  });

  /**
   * Get user vehicle bookings
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

      const result = await vehicleService.getUserBookings(req.user.userId, pagination, filters);

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
      const booking = await vehicleService.updateBooking(
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
      const result = await vehicleService.cancelBooking(id, req.user.userId);

      const response: ApiResponse = {
        success: true,
        message: result.message,
      };

      res.status(200).json(response);
    }
  );

  /**
   * Get vehicle types
   */
  getVehicleTypes = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const types = await vehicleService.getVehicleTypes();

    const response: ApiResponse = {
      success: true,
      data: { types },
    };

    res.status(200).json(response);
  });

  /**
   * Get vehicles by location
   */
  getVehiclesByLocation = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { location } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const vehicles = await vehicleService.getVehiclesByLocation(location, limit);

    const response: ApiResponse = {
      success: true,
      data: { vehicles },
    };

    res.status(200).json(response);
  });
}

export default new VehicleController();
