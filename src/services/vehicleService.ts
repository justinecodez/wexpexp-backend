import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import {
  VehicleResponse,
  ServiceFilter,
  BookingRequest,
  BookingResponse,
  PaginationQuery,
  PaginationInfo,
} from '../types';
import logger from '../config/logger';

export class VehicleService {
  /**
   * Get all vehicles with filtering and pagination
   */
  async getVehicles(
    filters: ServiceFilter & { vehicleType?: string; withDriver?: boolean },
    pagination: PaginationQuery
  ): Promise<{ vehicles: VehicleResponse[]; pagination: PaginationInfo }> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const { location, minPrice, maxPrice, vehicleType, withDriver, availability, search } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      availability: availability !== false, // Default to available vehicles
    };

    if (location) {
      where.location = location;
    }

    if (vehicleType) {
      where.vehicleType = vehicleType;
    }

    if (withDriver !== undefined) {
      where.withDriver = withDriver;
    }

    if (minPrice || maxPrice) {
      where.dailyRateTzs = {};
      if (minPrice) {
        where.dailyRateTzs.gte = minPrice;
      }
      if (maxPrice) {
        where.dailyRateTzs.lte = maxPrice;
      }
    }

    if (search) {
      where.OR = [
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { licensePlate: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await prisma.vehicle.count({ where });

    // Get vehicles
    const vehicles = await prisma.vehicle.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    });

    const formattedVehicles = vehicles.map(this.formatVehicleResponse);

    const paginationInfo: PaginationInfo = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };

    return {
      vehicles: formattedVehicles,
      pagination: paginationInfo,
    };
  }

  /**
   * Get vehicle by ID
   */
  async getVehicleById(vehicleId: string): Promise<VehicleResponse> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new AppError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
    }

    if (!vehicle.availability) {
      throw new AppError('Vehicle is not available', 404, 'VEHICLE_NOT_AVAILABLE');
    }

    return this.formatVehicleResponse(vehicle);
  }

  /**
   * Check vehicle availability
   */
  async checkAvailability(
    vehicleId: string,
    startDate: string,
    endDate: string
  ): Promise<{ available: boolean; conflictingBookings?: any[] }> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new AppError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
    }

    if (!vehicle.availability) {
      return { available: false };
    }

    // Check for conflicting bookings
    const conflictingBookings = await prisma.booking.findMany({
      where: {
        serviceId: vehicleId,
        serviceType: 'VEHICLE',
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [
          {
            startDate: {
              lte: new Date(endDate),
            },
            endDate: {
              gte: new Date(startDate),
            },
          },
        ],
      },
    });

    return {
      available: conflictingBookings.length === 0,
      conflictingBookings: conflictingBookings.length > 0 ? conflictingBookings : undefined,
    };
  }

  /**
   * Book a vehicle
   */
  async bookVehicle(userId: string, bookingData: BookingRequest): Promise<BookingResponse> {
    const { serviceId, bookingDate, startDate, endDate, specialRequests } = bookingData;

    if (!startDate || !endDate) {
      throw new AppError(
        'Start date and end date are required for vehicle booking',
        400,
        'DATES_REQUIRED'
      );
    }

    // Verify vehicle exists and is available
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: serviceId },
    });

    if (!vehicle) {
      throw new AppError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
    }

    if (!vehicle.availability) {
      throw new AppError('Vehicle is not available', 400, 'VEHICLE_NOT_AVAILABLE');
    }

    // Check availability for the requested dates
    const availabilityCheck = await this.checkAvailability(serviceId, startDate, endDate);
    if (!availabilityCheck.available) {
      throw new AppError(
        'Vehicle is not available for the selected dates',
        400,
        'DATES_NOT_AVAILABLE'
      );
    }

    // Calculate rental duration and total amount
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (days <= 0) {
      throw new AppError('End date must be after start date', 400, 'INVALID_DATE_RANGE');
    }

    const dailyRate = parseFloat(vehicle.dailyRateTzs.toString());
    const driverRate =
      vehicle.withDriver && vehicle.driverRateTzs
        ? parseFloat(vehicle.driverRateTzs.toString())
        : 0;

    const totalAmountTzs = (dailyRate + driverRate) * days;

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        userId,
        serviceType: 'VEHICLE',
        serviceId,
        bookingDate: new Date(bookingDate),
        startDate: start,
        endDate: end,
        totalAmountTzs,
        specialRequests,
        status: 'PENDING',
        paymentStatus: 'PENDING',
      },
    });

    logger.info(`Vehicle booked: ${booking.id} for vehicle: ${serviceId} by user: ${userId}`);

    return this.formatBookingResponse(booking);
  }

  /**
   * Get user vehicle bookings
   */
  async getUserBookings(
    userId: string,
    pagination: PaginationQuery,
    filters?: { status?: string }
  ): Promise<{ bookings: BookingResponse[]; pagination: PaginationInfo }> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      userId,
      serviceType: 'VEHICLE',
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    // Get total count
    const total = await prisma.booking.count({ where });

    // Get bookings with vehicle details
    const bookings = await prisma.booking.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        vehicle: {
          select: {
            make: true,
            model: true,
            year: true,
            vehicleType: true,
            seatingCapacity: true,
            transmission: true,
            fuelType: true,
            images: true,
            withDriver: true,
            location: true,
            licensePlate: true,
          },
        },
      },
    });

    const formattedBookings = bookings.map((booking: any) => ({
      ...this.formatBookingResponse(booking),
      vehicle: booking.vehicle,
    }));

    const paginationInfo: PaginationInfo = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };

    return {
      bookings: formattedBookings,
      pagination: paginationInfo,
    };
  }

  /**
   * Update booking
   */
  async updateBooking(
    bookingId: string,
    userId: string,
    updateData: { status?: string; paymentStatus?: string; specialRequests?: string }
  ): Promise<BookingResponse> {
    // Verify booking ownership
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.userId !== userId) {
      throw new AppError('Access denied to this booking', 403, 'BOOKING_ACCESS_DENIED');
    }

    // Update booking
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
    });

    logger.info(`Vehicle booking updated: ${bookingId} by user: ${userId}`);

    return this.formatBookingResponse(updatedBooking);
  }

  /**
   * Cancel booking
   */
  async cancelBooking(bookingId: string, userId: string): Promise<{ message: string }> {
    // Verify booking ownership
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.userId !== userId) {
      throw new AppError('Access denied to this booking', 403, 'BOOKING_ACCESS_DENIED');
    }

    if (booking.status === 'CANCELLED') {
      throw new AppError('Booking is already cancelled', 400, 'ALREADY_CANCELLED');
    }

    // Check cancellation policy
    const startDate = new Date(booking.startDate!);
    const now = new Date();
    const hoursUntilStart = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilStart < 24) {
      throw new AppError(
        'Vehicle bookings can only be cancelled 24 hours in advance',
        400,
        'CANCELLATION_DEADLINE_PASSED'
      );
    }

    // Update booking status
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancellationReason: 'Cancelled by user',
      },
    });

    logger.info(`Vehicle booking cancelled: ${bookingId} by user: ${userId}`);

    return { message: 'Booking cancelled successfully' };
  }

  /**
   * Get vehicle types
   */
  async getVehicleTypes(): Promise<Array<{ type: string; count: number }>> {
    const types = await prisma.vehicle.groupBy({
      by: ['vehicleType'],
      where: { availability: true },
      _count: true,
    });

    return types.map((type: any) => ({
      type: type.vehicleType,
      count: type._count,
    }));
  }

  /**
   * Get vehicles by location
   */
  async getVehiclesByLocation(location: string, limit: number = 10): Promise<VehicleResponse[]> {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        location: location as any,
        availability: true,
      },
      take: limit,
      orderBy: { dailyRateTzs: 'asc' },
    });

    return vehicles.map(this.formatVehicleResponse);
  }

  /**
   * Format vehicle response
   */
  private formatVehicleResponse(vehicle: any): VehicleResponse {
    return {
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      vehicleType: vehicle.vehicleType,
      dailyRateTzs: parseFloat(vehicle.dailyRateTzs.toString()),
      features: vehicle.features,
      seatingCapacity: vehicle.seatingCapacity,
      transmission: vehicle.transmission,
      fuelType: vehicle.fuelType,
      images: vehicle.images || [],
      location: vehicle.location,
      availability: vehicle.availability,
      withDriver: vehicle.withDriver,
      driverRateTzs: vehicle.driverRateTzs
        ? parseFloat(vehicle.driverRateTzs.toString())
        : undefined,
    };
  }

  /**
   * Format booking response
   */
  private formatBookingResponse(booking: any): BookingResponse {
    return {
      id: booking.id,
      serviceType: booking.serviceType,
      serviceId: booking.serviceId,
      bookingDate: booking.bookingDate,
      startDate: booking.startDate,
      endDate: booking.endDate,
      guests: booking.guests,
      totalAmountTzs: parseFloat(booking.totalAmountTzs.toString()),
      currency: booking.currency,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      specialRequests: booking.specialRequests,
      createdAt: booking.createdAt,
    };
  }
}

export default new VehicleService();
