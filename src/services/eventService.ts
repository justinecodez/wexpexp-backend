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
import { validateTanzanianPhone } from '../utils/tanzania';
import logger from '../config/logger';

export class EventService {
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

    const event = await prisma.event.create({
      data: {
        userId,
        title,
        description,
        eventType: eventType as any,
        eventDate: eventDateTime,
        startTime,
        endTime,
        venueName,
        venueAddress,
        venueCity: venueCity as any,
        maxGuests,
        budget: budget ? budget.toString() : null,
        isPublic,
      },
    });

    logger.info(`Event created: ${event.id} by user: ${userId}`);

    return this.formatEventResponse(event);
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

    // Get total count
    const total = await prisma.event.count({ where });

    // Get events
    const events = await prisma.event.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    });

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

    // Get total count
    const total = await prisma.event.count({ where });

    // Get events
    const events = await prisma.event.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
      },
    });

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
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            companyName: true,
            email: true,
          },
        },
        invitations: {
          select: {
            id: true,
            guestName: true,
            rsvpStatus: true,
            checkInTime: true,
          },
        },
        eCards: true,
      },
    });

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
    // Check if event exists and belongs to user
    const existingEvent = await prisma.event.findUnique({
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

    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...updateData,
        eventDate: updateData.eventDate ? new Date(updateData.eventDate) : undefined,
        eventType: updateData.eventType as any,
        venueCity: updateData.venueCity as any,
        budget: updateData.budget ? updateData.budget.toString() : undefined,
      },
    });

    logger.info(`Event updated: ${eventId} by user: ${userId}`);

    return this.formatEventResponse(updatedEvent);
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string, userId: string): Promise<{ message: string }> {
    // Check if event exists and belongs to user
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    if (event.userId !== userId) {
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    await prisma.event.delete({
      where: { id: eventId },
    });

    logger.info(`Event deleted: ${eventId} by user: ${userId}`);

    return { message: 'Event deleted successfully' };
  }

  /**
   * Duplicate an event
   */
  async duplicateEvent(eventId: string, userId: string): Promise<EventResponse> {
    // Get original event
    const originalEvent = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!originalEvent) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    if (originalEvent.userId !== userId) {
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    // Create new event with modified title
    const newEvent = await prisma.event.create({
      data: {
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
        status: 'DRAFT',
      },
    });

    logger.info(`Event duplicated: ${eventId} -> ${newEvent.id} by user: ${userId}`);

    return this.formatEventResponse(newEvent);
  }

  /**
   * Get event analytics
   */
  async getEventAnalytics(eventId: string, userId: string): Promise<EventAnalyticsResponse> {
    // Check if event exists and belongs to user
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    if (event.userId !== userId) {
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    // Get invitation statistics
    const invitationStats = await prisma.invitation.groupBy({
      by: ['rsvpStatus', 'deliveryStatus'],
      where: { eventId },
      _count: true,
    });

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
      totalInvitations += stat._count;

      if (stat.rsvpStatus === 'ACCEPTED') totalAccepted += stat._count;
      if (stat.rsvpStatus === 'DECLINED') totalDeclined += stat._count;
      if (stat.rsvpStatus === 'PENDING') totalPending += stat._count;
    });

    // Get delivery statistics by method
    const deliveryStats = await prisma.invitation.groupBy({
      by: ['invitationMethod', 'deliveryStatus'],
      where: { eventId },
      _count: true,
    });

    deliveryStats.forEach((stat: any) => {
      if (stat.invitationMethod === 'EMAIL') {
        emailSent += stat._count;
        if (stat.deliveryStatus === 'DELIVERED') emailDelivered += stat._count;
      }
      if (stat.invitationMethod === 'SMS') {
        smsSent += stat._count;
        if (stat.deliveryStatus === 'DELIVERED') smsDelivered += stat._count;
      }
      if (stat.invitationMethod === 'WHATSAPP') {
        whatsappSent += stat._count;
        if (stat.deliveryStatus === 'DELIVERED') whatsappDelivered += stat._count;
      }
    });

    // Get check-in count
    const totalCheckedIn = await prisma.invitation.count({
      where: {
        eventId,
        checkInTime: { not: null },
      },
    });

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
