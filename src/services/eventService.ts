import database from '../config/database';
import { Event } from '../entities/Event';
import { Invitation } from '../entities/Invitation';
import { User } from '../entities/User';
import { Repository } from 'typeorm';
import { AppError } from '../middleware/errorHandler';
import {
  CreateEventRequest,
  EventResponse,
  EventFilter,
  PaginationQuery,
  PaginationInfo,
  EventAnalyticsResponse,
} from '../types';

import logger from '../config/logger';

export class EventService {
  private eventRepository: Repository<Event>;
  private invitationRepository: Repository<Invitation>;
  private userRepository: Repository<User>;

  constructor() {
    this.eventRepository = database.getRepository(Event) as Repository<Event>;
    this.invitationRepository = database.getRepository(Invitation) as Repository<Invitation>;
    this.userRepository = database.getRepository(User) as Repository<User>;
  }
  /**
   * Create a new event
   */
  async createEvent(userId: string, eventData: CreateEventRequest): Promise<EventResponse> {
    const {
      title,
      description,
      eventType,
      eventDate,
      startTime,
      endTime,
      hostname,
      brideName,
      groomName,
      venueName,
      venueAddress,
      venueCity,
      maxGuests,
      budget,
      isPublic = false,
    } = eventData;

    // Validate event date is not in the past
    const eventDateTime = new Date(eventDate);
    if (eventDateTime < new Date()) {
      throw new AppError('Event date cannot be in the past', 400, 'INVALID_EVENT_DATE');
    }

    // Validate start time and end time
    if (endTime && startTime >= endTime) {
      throw new AppError('End time must be after start time', 400, 'INVALID_TIME_RANGE');
    }

    const event = this.eventRepository.create({
      userId,
      title,
      description,
      eventType: eventType as any,
      eventDate: eventDateTime,
      startTime,
      endTime,
      hostname,
      brideName,
      groomName,
      venueName,
      venueAddress,
      venueCity: venueCity as any,
      maxGuests,
      budget: budget || 0,
      isPublic,
    });

    const savedEvent = await this.eventRepository.save(event);

    logger.info(`Event created: ${savedEvent.id} by user: ${userId}`);

    return this.formatEventResponse(savedEvent);
  }

  /**
   * Get events for a user with filtering and pagination
   */
  async getUserEvents(
    userId: string,
    filters: EventFilter,
    pagination: PaginationQuery
  ): Promise<{ events: EventResponse[]; pagination: PaginationInfo }> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const { status, eventType, venueCity, startDate, endDate, search } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      userId,
    };

    if (status) {
      where.status = status;
    }

    if (eventType) {
      where.eventType = eventType;
    }

    if (venueCity) {
      where.venueCity = venueCity;
    }

    if (startDate || endDate) {
      where.eventDate = {};
      if (startDate) {
        where.eventDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.eventDate.lte = new Date(endDate);
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { venueName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build TypeORM query
    const queryBuilder = this.eventRepository.createQueryBuilder('event');
    queryBuilder.where('event.userId = :userId', { userId });

    if (status) {
      queryBuilder.andWhere('event.status = :status', { status });
    }
    if (eventType) {
      queryBuilder.andWhere('event.eventType = :eventType', { eventType });
    }
    if (venueCity) {
      queryBuilder.andWhere('event.venueCity = :venueCity', { venueCity });
    }
    if (startDate) {
      queryBuilder.andWhere('event.eventDate >= :startDate', { startDate: new Date(startDate) });
    }
    if (endDate) {
      queryBuilder.andWhere('event.eventDate <= :endDate', { endDate: new Date(endDate) });
    }
    if (search) {
      queryBuilder.andWhere(
        '(event.title ILIKE :search OR event.description ILIKE :search OR event.venueName ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Get events with pagination
    const events = await queryBuilder
      .orderBy(`event.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    const formattedEvents = events.map(this.formatEventResponse);

    const paginationInfo: PaginationInfo = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };

    return {
      events: formattedEvents,
      pagination: paginationInfo,
    };
  }

  /**
   * Get public events with filtering and pagination
   */
  async getPublicEvents(
    filters: EventFilter,
    pagination: PaginationQuery
  ): Promise<{ events: EventResponse[]; pagination: PaginationInfo }> {
    const { page = 1, limit = 10, sortBy = 'eventDate', sortOrder = 'asc' } = pagination;
    const { eventType, venueCity, startDate, endDate, search } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      isPublic: true,
      status: 'ACTIVE',
      eventDate: {
        gte: new Date(), // Only future events
      },
    };

    if (eventType) {
      where.eventType = eventType;
    }

    if (venueCity) {
      where.venueCity = venueCity;
    }

    if (startDate || endDate) {
      if (startDate) {
        where.eventDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.eventDate.lte = new Date(endDate);
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { venueName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build TypeORM query for public events
    const queryBuilder = this.eventRepository.createQueryBuilder('event');
    queryBuilder
      .leftJoinAndSelect('event.user', 'user')
      .where('event.isPublic = :isPublic', { isPublic: true })
      .andWhere('event.status = :status', { status: 'ACTIVE' })
      .andWhere('event.eventDate >= :now', { now: new Date() });

    if (eventType) {
      queryBuilder.andWhere('event.eventType = :eventType', { eventType });
    }
    if (venueCity) {
      queryBuilder.andWhere('event.venueCity = :venueCity', { venueCity });
    }
    if (startDate) {
      queryBuilder.andWhere('event.eventDate >= :startDate', { startDate: new Date(startDate) });
    }
    if (endDate) {
      queryBuilder.andWhere('event.eventDate <= :endDate', { endDate: new Date(endDate) });
    }
    if (search) {
      queryBuilder.andWhere(
        '(event.title ILIKE :search OR event.description ILIKE :search OR event.venueName ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Get events with user data
    const events = await queryBuilder
      .orderBy(`event.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    const formattedEvents = events.map((event: any) => ({
      ...this.formatEventResponse(event),
      organizer: {
        name: event.user.companyName || `${event.user.firstName} ${event.user.lastName}`,
      },
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
      events: formattedEvents,
      pagination: paginationInfo,
    };
  }

  /**
   * Get a single event by ID
   */
  async getEventById(eventId: string, userId?: string): Promise<EventResponse> {
    const event = await this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.user', 'user')
      .leftJoinAndSelect('event.invitations', 'invitations')
      .leftJoinAndSelect('event.eCards', 'eCards')
      .where('event.id = :eventId', { eventId })
      .getOne();

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    // Check access permissions
    if (!event.isPublic && event.userId !== userId) {
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    return {
      ...this.formatEventResponse(event),
      organizer: {
        name: event.user.companyName || `${event.user.firstName} ${event.user.lastName}`,
        email: event.userId === userId ? event.user.email : undefined,
      },
      invitations: event.invitations,
      eCards: event.eCards,
    };
  }

  /**
   * Update an event
   */
  async updateEvent(
    eventId: string,
    userId: string,
    updateData: Partial<CreateEventRequest>
  ): Promise<EventResponse> {
    // Debug: Log what's being received
    console.log('=== UPDATE EVENT DEBUG ===');
    console.log('eventId:', eventId);
    console.log('hostname:', updateData.hostname);
    console.log('brideName:', updateData.brideName);
    console.log('groomName:', updateData.groomName);
    console.log('Full updateData:', JSON.stringify(updateData, null, 2));
    console.log('=== END DEBUG ===');

    // Check if event exists and belongs to user
    const existingEvent = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    if (!existingEvent) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    if (existingEvent.userId !== userId) {
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    // Validate event date if provided
    if (updateData.eventDate) {
      const eventDateTime = new Date(updateData.eventDate);
      if (eventDateTime < new Date()) {
        throw new AppError('Event date cannot be in the past', 400, 'INVALID_EVENT_DATE');
      }
    }

    // Validate time range if both times are provided
    if (updateData.startTime && updateData.endTime) {
      if (updateData.startTime >= updateData.endTime) {
        throw new AppError('End time must be after start time', 400, 'INVALID_TIME_RANGE');
      }
    }

    const updatePayload: any = { ...updateData };
    if (updateData.eventDate) {
      updatePayload.eventDate = new Date(updateData.eventDate);
    }
    if (updateData.eventType) {
      updatePayload.eventType = updateData.eventType as any;
    }
    if (updateData.venueCity) {
      updatePayload.venueCity = updateData.venueCity as any;
    }
    if (updateData.budget !== undefined) {
      updatePayload.budget = updateData.budget;
    }

    await this.eventRepository.update({ id: eventId }, updatePayload);
    const updatedEvent = await this.eventRepository.findOne({ where: { id: eventId } });

    logger.info(`Event updated: ${eventId} by user: ${userId}`);

    return this.formatEventResponse(updatedEvent);
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string, userId: string): Promise<{ message: string }> {
    // Check if event exists and belongs to user
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    if (event.userId !== userId) {
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    await this.eventRepository.delete({ id: eventId });

    logger.info(`Event deleted: ${eventId} by user: ${userId}`);

    return { message: 'Event deleted successfully' };
  }

  /**
   * Duplicate an event
   */
  async duplicateEvent(eventId: string, userId: string): Promise<EventResponse> {
    // Get original event
    const originalEvent = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    if (!originalEvent) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    if (originalEvent.userId !== userId) {
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    // Create new event with modified title
    const newEvent = this.eventRepository.create({
      userId,
      title: `${originalEvent.title} (Copy)`,
      description: originalEvent.description,
      eventType: originalEvent.eventType,
      eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      startTime: originalEvent.startTime,
      endTime: originalEvent.endTime,
      venueName: originalEvent.venueName,
      venueAddress: originalEvent.venueAddress,
      venueCity: originalEvent.venueCity,
      maxGuests: originalEvent.maxGuests,
      budget: originalEvent.budget,
      isPublic: false, // Always create as private
      status: 'DRAFT' as any,
    });

    const savedNewEvent = await this.eventRepository.save(newEvent);

    logger.info(`Event duplicated: ${eventId} -> ${savedNewEvent.id} by user: ${userId}`);

    return this.formatEventResponse(savedNewEvent);
  }

  /**
   * Get event analytics
   */
  async getEventAnalytics(eventId: string, userId: string): Promise<EventAnalyticsResponse> {
    // Check if event exists and belongs to user
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    if (event.userId !== userId) {
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    // Get invitation statistics using raw query for groupBy functionality
    const invitationStats = await this.invitationRepository
      .createQueryBuilder('invitation')
      .select('invitation.rsvpStatus', 'rsvpStatus')
      .addSelect('invitation.deliveryStatus', 'deliveryStatus')
      .addSelect('COUNT(*)', 'count')
      .where('invitation.eventId = :eventId', { eventId })
      .groupBy('invitation.rsvpStatus, invitation.deliveryStatus')
      .getRawMany();

    // Calculate totals
    let totalInvitations = 0;
    let totalAccepted = 0;
    let totalDeclined = 0;
    let totalPending = 0;
    let emailDelivered = 0;
    let emailSent = 0;
    let smsDelivered = 0;
    let smsSent = 0;
    let whatsappDelivered = 0;
    let whatsappSent = 0;

    invitationStats.forEach((stat: any) => {
      const count = parseInt(stat.count);
      totalInvitations += count;

      if (stat.rsvpStatus === 'ACCEPTED') totalAccepted += count;
      if (stat.rsvpStatus === 'DECLINED') totalDeclined += count;
      if (stat.rsvpStatus === 'PENDING') totalPending += count;
    });

    // Get delivery statistics by method
    const deliveryStats = await this.invitationRepository
      .createQueryBuilder('invitation')
      .select('invitation.invitationMethod', 'invitationMethod')
      .addSelect('invitation.deliveryStatus', 'deliveryStatus')
      .addSelect('COUNT(*)', 'count')
      .where('invitation.eventId = :eventId', { eventId })
      .groupBy('invitation.invitationMethod, invitation.deliveryStatus')
      .getRawMany();

    deliveryStats.forEach((stat: any) => {
      const count = parseInt(stat.count);
      if (stat.invitationMethod === 'EMAIL') {
        emailSent += count;
        if (stat.deliveryStatus === 'DELIVERED') emailDelivered += count;
      }
      if (stat.invitationMethod === 'SMS') {
        smsSent += count;
        if (stat.deliveryStatus === 'DELIVERED') smsDelivered += count;
      }
      if (stat.invitationMethod === 'WHATSAPP') {
        whatsappSent += count;
        if (stat.deliveryStatus === 'DELIVERED') whatsappDelivered += count;
      }
    });

    // Get check-in count
    const totalCheckedIn = await this.invitationRepository
      .createQueryBuilder('invitation')
      .where('invitation.eventId = :eventId', { eventId })
      .andWhere('invitation.checkInTime IS NOT NULL')
      .getCount();

    // Calculate rates
    const acceptanceRate = totalInvitations > 0 ? (totalAccepted / totalInvitations) * 100 : 0;
    const attendanceRate = totalAccepted > 0 ? (totalCheckedIn / totalAccepted) * 100 : 0;

    return {
      totalInvitations,
      totalAccepted,
      totalDeclined,
      totalPending,
      totalCheckedIn,
      acceptanceRate: Math.round(acceptanceRate * 100) / 100,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
      deliveryRates: {
        email: emailSent > 0 ? Math.round((emailDelivered / emailSent) * 10000) / 100 : 0,
        sms: smsSent > 0 ? Math.round((smsDelivered / smsSent) * 10000) / 100 : 0,
        whatsapp:
          whatsappSent > 0 ? Math.round((whatsappDelivered / whatsappSent) * 10000) / 100 : 0,
      },
    };
  }

  /**
   * Format event response
   */
  private formatEventResponse(event: any): EventResponse {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      eventType: event.eventType,
      eventDate: event.eventDate,
      startTime: event.startTime,
      endTime: event.endTime,
      hostname: event.hostname,
      brideName: event.brideName,
      groomName: event.groomName,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      venueCity: event.venueCity,
      maxGuests: event.maxGuests,
      currentRsvpCount: event.currentRsvpCount,
      budget: event.budget ? parseFloat(event.budget) : undefined,
      currency: event.currency,
      status: event.status,
      isPublic: event.isPublic,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }
}

export default new EventService();
