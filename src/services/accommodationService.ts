import database from '../config/database';
import { AppError } from '../middleware/errorHandler';
import {
  ServiceFilter,
  BookingRequest,
  BookingResponse,
  PaginationQuery,
  PaginationInfo,
} from '../types';
import logger from '../config/logger';
import { Accommodation } from '../entities/Accommodation';
import { Booking } from '../entities/Booking';
import { BookingStatus, PaymentStatus, ServiceType } from '../entities/enums';
import { Repository } from 'typeorm';

export class AccommodationService {
  private accommodationRepository: Repository<Accommodation>;
  private bookingRepository: Repository<Booking>;

  constructor() {
    this.accommodationRepository = database.getRepository(
      Accommodation
    ) as Repository<Accommodation>;
    this.bookingRepository = database.getRepository(Booking) as Repository<Booking>;
  }

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

    // Build query using TypeORM query builder
    const queryBuilder = this.accommodationRepository.createQueryBuilder('accommodation');

    // Apply basic filters
    queryBuilder.where('accommodation.isActive = :isActive', { isActive: true });

    if (location) {
      queryBuilder.andWhere('accommodation.location = :location', { location });
    }

    if (type) {
      queryBuilder.andWhere('accommodation.type = :type', { type });
    }

    // Handle search
    if (search) {
      queryBuilder.andWhere(
        '(accommodation.name ILIKE :search OR accommodation.description ILIKE :search OR accommodation.address ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Get accommodations with pagination and sorting
    const accommodations = await queryBuilder
      .orderBy(`accommodation.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

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
    const accommodation = await this.accommodationRepository.findOne({
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
    const accommodation = await this.accommodationRepository.findOne({
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
    const booking = this.bookingRepository.create({
      userId,
      serviceType: ServiceType.ACCOMMODATION,
      serviceId,
      bookingDate: new Date(bookingDate),
      startDate: checkIn,
      endDate: checkOut,
      guests: guests || 1,
      totalAmountTzs,
      specialRequests,
      status: BookingStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
    });

    const savedBooking = await this.bookingRepository.save(booking);

    logger.info(
      `Accommodation booked: ${savedBooking.id} for accommodation: ${serviceId} by user: ${userId}`
    );

    return this.formatBookingResponse(savedBooking);
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

    const total = await this.bookingRepository.count({ where });

    const bookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.accommodation', 'accommodation')
      .where('booking.userId = :userId', { userId })
      .andWhere('booking.serviceType = :serviceType', { serviceType: ServiceType.ACCOMMODATION })
      .andWhere(filters?.status ? 'booking.status = :status' : '1=1', { status: filters?.status })
      .orderBy(`booking.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

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
   * Get popular accommodations
   */
  async getPopularAccommodations(limit: number = 10, location?: string): Promise<any[]> {
    const queryBuilder = this.accommodationRepository.createQueryBuilder('accommodation')
      .where('accommodation.isActive = :isActive', { isActive: true })
      .orderBy('accommodation.rating', 'DESC');

    if (location) {
      queryBuilder.andWhere('accommodation.location = :location', { location });
    }

    const accommodations = await queryBuilder
      .take(limit)
      .getMany();

    return accommodations.map(this.formatAccommodationResponse);
  }

  /**
   * Search accommodations
   */
  async searchAccommodations(searchParams: any): Promise<any> {
    const { location, checkIn, checkOut, guests, type, minPrice, maxPrice, amenities } = searchParams;

    const queryBuilder = this.accommodationRepository.createQueryBuilder('accommodation')
      .where('accommodation.isActive = :isActive', { isActive: true });

    if (location) {
      queryBuilder.andWhere('accommodation.location = :location', { location });
    }

    if (type) {
      queryBuilder.andWhere('accommodation.type = :type', { type });
    }

    if (minPrice) {
      queryBuilder.andWhere('accommodation.basePrice >= :minPrice', { minPrice });
    }

    if (maxPrice) {
      queryBuilder.andWhere('accommodation.basePrice <= :maxPrice', { maxPrice });
    }

    if (amenities && amenities.length > 0) {
      queryBuilder.andWhere('accommodation.amenities @> :amenities', { amenities });
    }

    const accommodations = await queryBuilder.getMany();

    return accommodations.map(this.formatAccommodationResponse);
  }

  /**
   * Get available locations
   */
  async getAvailableLocations(): Promise<string[]> {
    const locations = await this.accommodationRepository
      .createQueryBuilder('accommodation')
      .select('DISTINCT accommodation.location')
      .where('accommodation.isActive = :isActive', { isActive: true })
      .getRawMany();

    return locations.map((item: any) => item.location);
  }

  /**
   * Create accommodation
   */
  async createAccommodation(accommodationData: any): Promise<any> {
    const accommodation = this.accommodationRepository.create(accommodationData);
    const savedAccommodation = await this.accommodationRepository.save(accommodation);
    return this.formatAccommodationResponse(savedAccommodation);
  }

  /**
   * Update accommodation
   */
  async updateAccommodation(id: string, userId: string, updateData: any): Promise<any> {
    const accommodation = await this.accommodationRepository.findOne({
      where: { id },
    });

    if (!accommodation) {
      throw new AppError('Accommodation not found', 404, 'ACCOMMODATION_NOT_FOUND');
    }

    Object.assign(accommodation, updateData);
    const updatedAccommodation = await this.accommodationRepository.save(accommodation);
    return this.formatAccommodationResponse(updatedAccommodation);
  }

  /**
   * Delete accommodation
   */
  async deleteAccommodation(id: string, userId: string): Promise<void> {
    const accommodation = await this.accommodationRepository.findOne({
      where: { id },
    });

    if (!accommodation) {
      throw new AppError('Accommodation not found', 404, 'ACCOMMODATION_NOT_FOUND');
    }

    await this.accommodationRepository.softDelete(id);
  }

  /**
   * Update accommodation availability
   */
  async updateAvailability(id: string, userId: string, availabilityData: any): Promise<any> {
    const accommodation = await this.accommodationRepository.findOne({
      where: { id },
    });

    if (!accommodation) {
      throw new AppError('Accommodation not found', 404, 'ACCOMMODATION_NOT_FOUND');
    }

    accommodation.isActive = availabilityData.isActive;
    const updatedAccommodation = await this.accommodationRepository.save(accommodation);
    return this.formatAccommodationResponse(updatedAccommodation);
  }

  /**
   * Update booking
   */
  async updateBooking(id: string, userId: string, updateData: any): Promise<BookingResponse> {
    const booking = await this.bookingRepository.findOne({
      where: { id, userId },
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new AppError('Cannot update cancelled booking', 400, 'BOOKING_CANCELLED');
    }

    Object.assign(booking, updateData);
    const updatedBooking = await this.bookingRepository.save(booking);

    return this.formatBookingResponse(updatedBooking);
  }

  /**
   * Cancel booking
   */
  async cancelBooking(id: string, userId: string): Promise<void> {
    const booking = await this.bookingRepository.findOne({
      where: { id, userId },
    });

    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new AppError('Booking is already cancelled', 400, 'BOOKING_ALREADY_CANCELLED');
    }

    booking.status = BookingStatus.CANCELLED;
    await this.bookingRepository.save(booking);
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
