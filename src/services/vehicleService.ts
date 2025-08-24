import database from '../config/database';
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
import { Vehicle } from '../entities/Vehicle';
import { Booking } from '../entities/Booking';
import { BookingStatus, PaymentStatus, ServiceType } from '../entities/enums';
import { Repository, Like, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';

export class VehicleService {
  private vehicleRepository: Repository<Vehicle>;
  private bookingRepository: Repository<Booking>;

  constructor() {
    this.vehicleRepository = database.getRepository(Vehicle) as Repository<Vehicle>;
    this.bookingRepository = database.getRepository(Booking) as Repository<Booking>;
  }

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

    if (minPrice && maxPrice) {
      where.dailyRateTzs = Between(minPrice, maxPrice);
    } else if (minPrice) {
      where.dailyRateTzs = MoreThanOrEqual(minPrice);
    } else if (maxPrice) {
      where.dailyRateTzs = LessThanOrEqual(maxPrice);
    }

    // For search, we'll need to handle it differently in TypeORM
    const queryBuilder = this.vehicleRepository.createQueryBuilder('vehicle');

    // Apply basic where conditions
    Object.keys(where).forEach(key => {
      if (key !== 'dailyRateTzs' || !search) {
        queryBuilder.andWhere(`vehicle.${key} = :${key}`, { [key]: where[key] });
      }
    });

    // Handle price range
    if (minPrice && maxPrice) {
      queryBuilder.andWhere('vehicle.dailyRateTzs BETWEEN :minPrice AND :maxPrice', {
        minPrice,
        maxPrice,
      });
    } else if (minPrice) {
      queryBuilder.andWhere('vehicle.dailyRateTzs >= :minPrice', { minPrice });
    } else if (maxPrice) {
      queryBuilder.andWhere('vehicle.dailyRateTzs <= :maxPrice', { maxPrice });
    }

    // Handle search
    if (search) {
      queryBuilder.andWhere(
        '(vehicle.make ILIKE :search OR vehicle.model ILIKE :search OR vehicle.licensePlate ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Get vehicles with pagination and sorting
    const vehicles = await queryBuilder
      .orderBy(`vehicle.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

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
    const vehicle = await this.vehicleRepository.findOne({
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
    const vehicle = await this.vehicleRepository.findOne({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new AppError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
    }

    if (!vehicle.availability) {
      return { available: false };
    }

    // Check for conflicting bookings using TypeORM query builder
    const conflictingBookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .where('booking.serviceId = :vehicleId', { vehicleId })
      .andWhere('booking.serviceType = :serviceType', { serviceType: ServiceType.VEHICLE })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      })
      .andWhere('(booking.startDate <= :endDate AND booking.endDate >= :startDate)', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      })
      .getMany();

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
    const vehicle = await this.vehicleRepository.findOne({
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
    const booking = this.bookingRepository.create({
      userId,
      serviceType: ServiceType.VEHICLE,
      serviceId,
      bookingDate: new Date(bookingDate),
      startDate: start,
      endDate: end,
      totalAmountTzs,
      specialRequests,
      status: BookingStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
    });

    const savedBooking = await this.bookingRepository.save(booking);

    logger.info(`Vehicle booked: ${savedBooking.id} for vehicle: ${serviceId} by user: ${userId}`);

    return this.formatBookingResponse(savedBooking);
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
    const total = await this.bookingRepository.count({ where });

    // Get bookings with vehicle details using query builder
    const bookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.vehicle', 'vehicle')
      .where('booking.userId = :userId', { userId })
      .andWhere('booking.serviceType = :serviceType', { serviceType: ServiceType.VEHICLE })
      .andWhere(filters?.status ? 'booking.status = :status' : '1=1', { status: filters?.status })
      .orderBy(`booking.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

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
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.userId !== userId) {
      throw new AppError('Access denied to this booking', 403, 'BOOKING_ACCESS_DENIED');
    }

    // Update booking
    Object.assign(booking, updateData);
    const updatedBooking = await this.bookingRepository.save(booking);

    logger.info(`Vehicle booking updated: ${bookingId} by user: ${userId}`);

    return this.formatBookingResponse(updatedBooking);
  }

  /**
   * Cancel booking
   */
  async cancelBooking(bookingId: string, userId: string): Promise<{ message: string }> {
    // Verify booking ownership
    const booking = await this.bookingRepository.findOne({
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
    booking.status = BookingStatus.CANCELLED;
    booking.cancellationReason = 'Cancelled by user';
    await this.bookingRepository.save(booking);

    logger.info(`Vehicle booking cancelled: ${bookingId} by user: ${userId}`);

    return { message: 'Booking cancelled successfully' };
  }

  /**
   * Get vehicle types
   */
  async getVehicleTypes(): Promise<Array<{ type: string; count: number }>> {
    const types = await this.vehicleRepository
      .createQueryBuilder('vehicle')
      .select('vehicle.vehicleType', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('vehicle.availability = :availability', { availability: true })
      .groupBy('vehicle.vehicleType')
      .getRawMany();

    return types.map((type: any) => ({
      type: type.type,
      count: parseInt(type.count),
    }));
  }

  /**
   * Get vehicles by location
   */
  async getVehiclesByLocation(location: string, limit: number = 10): Promise<VehicleResponse[]> {
    const vehicles = await this.vehicleRepository.find({
      where: {
        location: location as any,
        availability: true,
      },
      take: limit,
      order: { dailyRateTzs: 'ASC' },
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
