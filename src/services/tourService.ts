import database from '../config/database';
import { AppError } from '../middleware/errorHandler';
import {
  TourResponse,
  ServiceFilter,
  BookingRequest,
  BookingResponse,
  PaginationQuery,
  PaginationInfo,
} from '../types';
import logger from '../config/logger';
import { Tour } from '../entities/Tour';
import { Booking } from '../entities/Booking';
import { BookingStatus, PaymentStatus, ServiceType } from '../entities/enums';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';

export class TourService {
  private tourRepository: Repository<Tour>;
  private bookingRepository: Repository<Booking>;

  constructor() {
    this.tourRepository = database.getRepository(Tour) as Repository<Tour>;
    this.bookingRepository = database.getRepository(Booking) as Repository<Booking>;
  }

  /**
   * Get all tours with filtering and pagination
   */
  async getTours(
    filters: ServiceFilter,
    pagination: PaginationQuery
  ): Promise<{ tours: TourResponse[]; pagination: PaginationInfo }> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const { location, minPrice, maxPrice, category, search } = filters;

    const skip = (page - 1) * limit;

    // Build query using TypeORM query builder
    const queryBuilder = this.tourRepository.createQueryBuilder('tour');

    // Apply basic filters
    queryBuilder.where('tour.isActive = :isActive', { isActive: true });

    if (location) {
      queryBuilder.andWhere('tour.location = :location', { location });
    }

    if (category) {
      queryBuilder.andWhere('tour.category = :category', { category });
    }

    // Handle price range
    if (minPrice && maxPrice) {
      queryBuilder.andWhere('tour.priceTzs BETWEEN :minPrice AND :maxPrice', {
        minPrice,
        maxPrice,
      });
    } else if (minPrice) {
      queryBuilder.andWhere('tour.priceTzs >= :minPrice', { minPrice });
    } else if (maxPrice) {
      queryBuilder.andWhere('tour.priceTzs <= :maxPrice', { maxPrice });
    }

    // Handle search
    if (search) {
      queryBuilder.andWhere('(tour.name ILIKE :search OR tour.description ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Get tours with pagination and sorting
    const tours = await queryBuilder
      .orderBy(`tour.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    const formattedTours = tours.map(this.formatTourResponse);

    const paginationInfo: PaginationInfo = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };

    return {
      tours: formattedTours,
      pagination: paginationInfo,
    };
  }

  /**
   * Get tour by ID
   */
  async getTourById(tourId: string): Promise<TourResponse> {
    const tour = await this.tourRepository.findOne({
      where: { id: tourId },
    });

    if (!tour) {
      throw new AppError('Tour not found', 404, 'TOUR_NOT_FOUND');
    }

    if (!tour.isActive) {
      throw new AppError('Tour is not available', 404, 'TOUR_NOT_AVAILABLE');
    }

    return this.formatTourResponse(tour);
  }

  /**
   * Book a tour
   */
  async bookTour(userId: string, bookingRequest: BookingRequest): Promise<BookingResponse> {
    const { serviceId, bookingDate, startDate, endDate, guests, specialRequests } = bookingRequest;

    // Verify tour exists and is available
    const tour = await this.tourRepository.findOne({
      where: { id: serviceId },
    });

    if (!tour) {
      throw new AppError('Tour not found', 404, 'TOUR_NOT_FOUND');
    }

    if (!tour.isActive) {
      throw new AppError('Tour is not available', 400, 'TOUR_NOT_AVAILABLE');
    }

    // Check group size
    if (guests && guests > tour.maxPeople) {
      throw new AppError(
        `Tour can accommodate maximum ${tour.maxPeople} people`,
        400,
        'EXCEEDS_MAX_CAPACITY'
      );
    }

    // Calculate total amount
    const totalAmountTzs = parseFloat(tour.priceTzs.toString()) * (guests || 1);

    // Create booking
    const bookingData: any = {
      userId,
      serviceType: ServiceType.TOUR,
      serviceId,
      bookingDate: new Date(bookingDate),
      startDate: startDate ? new Date(startDate) : new Date(bookingDate),
      guests: guests || 1,
      totalAmountTzs: totalAmountTzs,
      specialRequests,
      status: BookingStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
    };

    if (endDate) {
      bookingData.endDate = new Date(endDate);
    }

    const booking = this.bookingRepository.create(bookingData);

    const savedBooking = await this.bookingRepository.save(booking);

    logger.info(
      `Tour booked: ${(savedBooking as any).id || savedBooking[0]?.id} for tour: ${serviceId} by user: ${userId}`
    );

    return this.formatBookingResponse(savedBooking);
  }

  /**
   * Get user tour bookings
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
      serviceType: 'TOUR',
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    // Get total count
    const total = await this.bookingRepository.count({ where });

    // Get bookings with tour details using query builder
    const bookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.tour', 'tour')
      .where('booking.userId = :userId', { userId })
      .andWhere('booking.serviceType = :serviceType', { serviceType: ServiceType.TOUR })
      .andWhere(filters?.status ? 'booking.status = :status' : '1=1', { status: filters?.status })
      .orderBy(`booking.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    const formattedBookings = bookings.map((booking: any) => ({
      ...this.formatBookingResponse(booking),
      tour: booking.tour,
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
   * Update booking status
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

    logger.info(`Tour booking updated: ${bookingId} by user: ${userId}`);

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

    // Check cancellation policy (e.g., can only cancel 48 hours before)
    const bookingDate = new Date(booking.bookingDate);
    const now = new Date();
    const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilBooking < 48) {
      throw new AppError(
        'Bookings can only be cancelled 48 hours in advance',
        400,
        'CANCELLATION_DEADLINE_PASSED'
      );
    }

    // Update booking status
    booking.status = BookingStatus.CANCELLED;
    booking.cancellationReason = 'Cancelled by user';
    await this.bookingRepository.save(booking);

    logger.info(`Tour booking cancelled: ${bookingId} by user: ${userId}`);

    return { message: 'Booking cancelled successfully' };
  }

  /**
   * Get popular tours
   */
  async getPopularTours(limit: number = 10): Promise<TourResponse[]> {
    // Get tours with most bookings
    const popularTours = await this.tourRepository.find({
      where: { isActive: true },
      order: {
        // This would need a field to track popularity
        // For now, ordering by creation date
        createdAt: 'DESC',
      },
      take: limit,
    });

    return popularTours.map(this.formatTourResponse);
  }

  /**
   * Get tours by category
   */
  async getToursByCategory(category: string, limit: number = 10): Promise<TourResponse[]> {
    const tours = await this.tourRepository.find({
      where: {
        category: category as any,
        isActive: true,
      },
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return tours.map(this.formatTourResponse);
  }

  /**
   * Format tour response
   */
  private formatTourResponse(tour: any): TourResponse {
    return {
      id: tour.id,
      name: tour.name,
      description: tour.description,
      duration: tour.duration,
      priceTzs: parseFloat(tour.priceTzs.toString()),
      location: tour.location,
      category: tour.category,
      images: tour.images || [],
      itinerary: tour.itinerary,
      inclusions: tour.inclusions || [],
      exclusions: tour.exclusions || [],
      maxPeople: tour.maxPeople,
      difficulty: tour.difficulty,
      isActive: tour.isActive,
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

export default new TourService();
