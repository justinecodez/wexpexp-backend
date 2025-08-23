import { prisma } from '../config/database';
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

export class TourService {
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

    // Build where clause
    const where: any = {
      isActive: true,
    };

    if (location) {
      where.location = location;
    }

    if (category) {
      where.category = category;
    }

    if (minPrice || maxPrice) {
      where.priceTzs = {};
      if (minPrice) {
        where.priceTzs.gte = minPrice;
      }
      if (maxPrice) {
        where.priceTzs.lte = maxPrice;
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await prisma.tour.count({ where });

    // Get tours
    const tours = await prisma.tour.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    });

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
    const tour = await prisma.tour.findUnique({
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
  async bookTour(userId: string, bookingData: BookingRequest): Promise<BookingResponse> {
    const { serviceId, bookingDate, startDate, endDate, guests, specialRequests } = bookingData;

    // Verify tour exists and is available
    const tour = await prisma.tour.findUnique({
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
    const booking = await prisma.booking.create({
      data: {
        userId,
        serviceType: 'TOUR',
        serviceId,
        bookingDate: new Date(bookingDate),
        startDate: startDate ? new Date(startDate) : new Date(bookingDate),
        endDate: endDate ? new Date(endDate) : null,
        guests: guests || 1,
        totalAmountTzs: totalAmountTzs,
        specialRequests,
        status: 'PENDING',
        paymentStatus: 'PENDING',
      },
    });

    logger.info(`Tour booked: ${booking.id} for tour: ${serviceId} by user: ${userId}`);

    return this.formatBookingResponse(booking);
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
    const total = await prisma.booking.count({ where });

    // Get bookings with tour details
    const bookings = await prisma.booking.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        tour: {
          select: {
            name: true,
            description: true,
            duration: true,
            location: true,
            category: true,
            images: true,
          },
        },
      },
    });

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

    logger.info(`Tour booking updated: ${bookingId} by user: ${userId}`);

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
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancellationReason: 'Cancelled by user',
      },
    });

    logger.info(`Tour booking cancelled: ${bookingId} by user: ${userId}`);

    return { message: 'Booking cancelled successfully' };
  }

  /**
   * Get popular tours
   */
  async getPopularTours(limit: number = 10): Promise<TourResponse[]> {
    // Get tours with most bookings
    const popularTours = await prisma.tour.findMany({
      where: { isActive: true },
      include: {
        bookings: {
          where: {
            status: { in: ['CONFIRMED', 'COMPLETED'] },
          },
        },
      },
      orderBy: {
        bookings: {
          _count: 'desc',
        },
      },
      take: limit,
    });

    return popularTours.map(this.formatTourResponse);
  }

  /**
   * Get tours by category
   */
  async getToursByCategory(category: string, limit: number = 10): Promise<TourResponse[]> {
    const tours = await prisma.tour.findMany({
      where: {
        category: category as any,
        isActive: true,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
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
