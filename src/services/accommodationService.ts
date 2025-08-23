import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import {
  ServiceFilter,
  BookingRequest,
  BookingResponse,
  PaginationQuery,
  PaginationInfo,
} from '../types';
import logger from '../config/logger';

export class AccommodationService {
  /**
   * Get all accommodations with filtering and pagination
   */
  async getAccommodations(
    filters: ServiceFilter & { type?: string; amenities?: string[] },
    pagination: PaginationQuery
  ): Promise<{ accommodations: any[]; pagination: PaginationInfo }> {
    const { page = 1, limit = 10, sortBy = 'rating', sortOrder = 'desc' } = pagination;
    const { location, minPrice, maxPrice, type, search } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      isActive: true,
    };

    if (location) {
      where.location = location;
    }

    if (type) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await prisma.accommodation.count({ where });

    // Get accommodations
    const accommodations = await prisma.accommodation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    });

    const formattedAccommodations = accommodations.map(this.formatAccommodationResponse);

    const paginationInfo: PaginationInfo = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };

    return {
      accommodations: formattedAccommodations,
      pagination: paginationInfo,
    };
  }

  /**
   * Get accommodation by ID
   */
  async getAccommodationById(accommodationId: string): Promise<any> {
    const accommodation = await prisma.accommodation.findUnique({
      where: { id: accommodationId },
    });

    if (!accommodation) {
      throw new AppError('Accommodation not found', 404, 'ACCOMMODATION_NOT_FOUND');
    }

    if (!accommodation.isActive) {
      throw new AppError('Accommodation is not available', 404, 'ACCOMMODATION_NOT_AVAILABLE');
    }

    return this.formatAccommodationResponse(accommodation);
  }

  /**
   * Book accommodation
   */
  async bookAccommodation(userId: string, bookingData: BookingRequest): Promise<BookingResponse> {
    const { serviceId, bookingDate, startDate, endDate, guests, specialRequests } = bookingData;

    if (!startDate || !endDate) {
      throw new AppError('Check-in and check-out dates are required', 400, 'DATES_REQUIRED');
    }

    // Verify accommodation exists
    const accommodation = await prisma.accommodation.findUnique({
      where: { id: serviceId },
    });

    if (!accommodation) {
      throw new AppError('Accommodation not found', 404, 'ACCOMMODATION_NOT_FOUND');
    }

    if (!accommodation.isActive) {
      throw new AppError('Accommodation is not available', 400, 'ACCOMMODATION_NOT_AVAILABLE');
    }

    // Calculate nights and total amount
    const checkIn = new Date(startDate);
    const checkOut = new Date(endDate);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    if (nights <= 0) {
      throw new AppError('Check-out date must be after check-in date', 400, 'INVALID_DATE_RANGE');
    }

    // Get base rate (simplified - in real implementation, would calculate based on room type and season)
    const rates = accommodation.rates as any;
    const baseRate = rates?.lowSeason?.standard || 250000; // Default rate in TZS
    const totalAmountTzs = baseRate * nights;

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        userId,
        serviceType: 'ACCOMMODATION',
        serviceId,
        bookingDate: new Date(bookingDate),
        startDate: checkIn,
        endDate: checkOut,
        guests: guests || 1,
        totalAmountTzs,
        specialRequests,
        status: 'PENDING',
        paymentStatus: 'PENDING',
      },
    });

    logger.info(
      `Accommodation booked: ${booking.id} for accommodation: ${serviceId} by user: ${userId}`
    );

    return this.formatBookingResponse(booking);
  }

  /**
   * Get user accommodation bookings
   */
  async getUserBookings(
    userId: string,
    pagination: PaginationQuery,
    filters?: { status?: string }
  ): Promise<{ bookings: BookingResponse[]; pagination: PaginationInfo }> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const skip = (page - 1) * limit;

    const where: any = {
      userId,
      serviceType: 'ACCOMMODATION',
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    const total = await prisma.booking.count({ where });

    const bookings = await prisma.booking.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        accommodation: {
          select: {
            name: true,
            type: true,
            location: true,
            address: true,
            images: true,
            amenities: true,
          },
        },
      },
    });

    const formattedBookings = bookings.map((booking: any) => ({
      ...this.formatBookingResponse(booking),
      accommodation: booking.accommodation,
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
   * Format accommodation response
   */
  private formatAccommodationResponse(accommodation: any): any {
    return {
      id: accommodation.id,
      name: accommodation.name,
      type: accommodation.type,
      location: accommodation.location,
      address: accommodation.address,
      description: accommodation.description,
      roomTypes: accommodation.roomTypes,
      amenities: accommodation.amenities,
      rates: accommodation.rates,
      images: accommodation.images || [],
      coordinates: accommodation.coordinates,
      checkInTime: accommodation.checkInTime,
      checkOutTime: accommodation.checkOutTime,
      policies: accommodation.policies,
      rating: accommodation.rating,
      totalRooms: accommodation.totalRooms,
      isActive: accommodation.isActive,
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

export default new AccommodationService();
