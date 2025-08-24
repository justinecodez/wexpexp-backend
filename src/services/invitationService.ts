import database from '../config/database';
import { Invitation } from '../entities/Invitation';
import { Event } from '../entities/Event';
import { User } from '../entities/User';
import { Repository, Not, IsNull, In } from 'typeorm';
import { RSVPStatus, DeliveryStatus, InvitationMethod } from '../entities/enums';
import { AppError } from '../middleware/errorHandler';
import {
  CreateInvitationRequest,
  BulkInvitationRequest,
  InvitationResponse,
  RSVPRequest,
  PaginationQuery,
  PaginationInfo,
} from '../types';
import { validateTanzanianPhone } from '../utils/tanzania';
import communicationService from './communicationService';
import QRCode from 'qrcode';
import crypto from 'crypto';
import logger from '../config/logger';
import { createObjectCsvWriter } from 'csv-writer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';

export class InvitationService {
  private invitationRepository: Repository<Invitation>;
  private eventRepository: Repository<Event>;
  private userRepository: Repository<User>;

  constructor() {
    this.invitationRepository = database.getRepository(Invitation) as Repository<Invitation>;
    this.eventRepository = database.getRepository(Event) as Repository<Event>;
    this.userRepository = database.getRepository(User) as Repository<User>;
  }

  /**
   * Create a single invitation
   */
  async createInvitation(
    userId: string,
    invitationData: CreateInvitationRequest
  ): Promise<InvitationResponse> {
    const { eventId, guestName, guestEmail, guestPhone, invitationMethod, specialRequirements } =
      invitationData;

    // Verify event ownership
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      select: ['userId', 'title', 'eventDate', 'maxGuests', 'currentRsvpCount'],
    });

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    if (event.userId !== userId) {
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    // Check guest limit
    if (event.currentRsvpCount >= event.maxGuests) {
      throw new AppError('Event has reached maximum guest capacity', 400, 'MAX_GUESTS_REACHED');
    }

    // Validate contact information based on method
    if (invitationMethod === 'EMAIL' && !guestEmail) {
      throw new AppError('Email is required for email invitations', 400, 'EMAIL_REQUIRED');
    }

    if ((invitationMethod === 'SMS' || invitationMethod === 'WHATSAPP') && !guestPhone) {
      throw new AppError(
        'Phone number is required for SMS/WhatsApp invitations',
        400,
        'PHONE_REQUIRED'
      );
    }

    // Validate phone number if provided
    let formattedPhone = guestPhone;
    if (guestPhone) {
      const phoneValidation = validateTanzanianPhone(guestPhone);
      if (!phoneValidation.isValid) {
        throw new AppError('Invalid Tanzanian phone number format', 400, 'INVALID_PHONE');
      }
      formattedPhone = phoneValidation.formatted;
    }

    // Check for duplicate invitations
    const existingInvitation = await this.invitationRepository
      .createQueryBuilder('invitation')
      .where('invitation.eventId = :eventId', { eventId })
      .andWhere('(invitation.guestEmail = :email OR invitation.guestPhone = :phone)', {
        email: guestEmail?.toLowerCase(),
        phone: formattedPhone,
      })
      .getOne();

    if (existingInvitation) {
      throw new AppError(
        'Guest has already been invited to this event',
        409,
        'DUPLICATE_INVITATION'
      );
    }

    // Generate QR code
    const qrCode = this.generateQRCode();
    const qrCodeDataUrl = await QRCode.toDataURL(qrCode);

    // Create invitation
    const invitation = this.invitationRepository.create({
      eventId,
      guestName,
      guestEmail: guestEmail?.toLowerCase(),
      guestPhone: formattedPhone,
      invitationMethod: invitationMethod as any,
      qrCode,
      specialRequirements,
      deliveryStatus: DeliveryStatus.PENDING,
      rsvpStatus: RSVPStatus.PENDING,
    });

    const savedInvitation = await this.invitationRepository.save(invitation);

    // Send invitation
    await this.sendInvitation(savedInvitation.id, event.title, event.eventDate);

    logger.info(`Invitation created: ${savedInvitation.id} for event: ${eventId}`);

    return this.formatInvitationResponse(savedInvitation);
  }

  /**
   * Create bulk invitations
   */
  async createBulkInvitations(
    userId: string,
    bulkData: BulkInvitationRequest
  ): Promise<{
    successful: InvitationResponse[];
    failed: Array<{ invitation: CreateInvitationRequest; error: string }>;
  }> {
    const { eventId, invitations } = bulkData;

    // Verify event ownership
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      select: ['userId', 'title', 'eventDate', 'maxGuests', 'currentRsvpCount'],
    });

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    if (event.userId !== userId) {
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    const successful: InvitationResponse[] = [];
    const failed: Array<{ invitation: CreateInvitationRequest; error: string }> = [];

    for (const invitationData of invitations) {
      try {
        const invitation = await this.createInvitation(userId, {
          ...invitationData,
          eventId,
        });
        successful.push(invitation);
      } catch (error) {
        failed.push({
          invitation: invitationData,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info(
      `Bulk invitations created: ${successful.length} successful, ${failed.length} failed`
    );

    return { successful, failed };
  }

  /**
   * Get invitations for an event
   */
  async getEventInvitations(
    eventId: string,
    userId: string,
    pagination: PaginationQuery,
    filters?: {
      rsvpStatus?: string;
      deliveryStatus?: string;
      invitationMethod?: string;
      search?: string;
    }
  ): Promise<{ invitations: InvitationResponse[]; pagination: PaginationInfo }> {
    // Verify event ownership
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      select: ['userId'],
    });

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    if (event.userId !== userId) {
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { eventId };

    if (filters?.rsvpStatus) {
      where.rsvpStatus = filters.rsvpStatus;
    }

    if (filters?.deliveryStatus) {
      where.deliveryStatus = filters.deliveryStatus;
    }

    if (filters?.invitationMethod) {
      where.invitationMethod = filters.invitationMethod;
    }

    // For search, we'll use query builder if needed
    if (filters?.search) {
      const queryBuilder = this.invitationRepository.createQueryBuilder('invitation');
      queryBuilder.where('invitation.eventId = :eventId', { eventId });

      if (filters.rsvpStatus) {
        queryBuilder.andWhere('invitation.rsvpStatus = :rsvpStatus', {
          rsvpStatus: filters.rsvpStatus,
        });
      }
      if (filters.deliveryStatus) {
        queryBuilder.andWhere('invitation.deliveryStatus = :deliveryStatus', {
          deliveryStatus: filters.deliveryStatus,
        });
      }
      if (filters.invitationMethod) {
        queryBuilder.andWhere('invitation.invitationMethod = :invitationMethod', {
          invitationMethod: filters.invitationMethod,
        });
      }

      queryBuilder.andWhere(
        '(invitation.guestName ILIKE :search OR invitation.guestEmail ILIKE :search OR invitation.guestPhone ILIKE :search)',
        { search: `%${filters.search}%` }
      );

      // Get total count
      const total = await queryBuilder.getCount();

      // Get invitations with pagination
      const invitations = await queryBuilder
        .orderBy(`invitation.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
        .skip(skip)
        .take(limit)
        .getMany();

      const formattedInvitations = invitations.map(this.formatInvitationResponse);

      const paginationInfo: PaginationInfo = {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };

      return {
        invitations: formattedInvitations,
        pagination: paginationInfo,
      };
    }

    // Get total count
    const total = await this.invitationRepository.count({ where });

    // Get invitations
    const invitations = await this.invitationRepository.find({
      where,
      skip,
      take: limit,
      order: { [sortBy]: sortOrder.toUpperCase() as 'ASC' | 'DESC' },
    });

    const formattedInvitations = invitations.map(this.formatInvitationResponse);

    const paginationInfo: PaginationInfo = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };

    return {
      invitations: formattedInvitations,
      pagination: paginationInfo,
    };
  }

  /**
   * Update RSVP status
   */
  async updateRSVP(invitationId: string, rsvpData: RSVPRequest): Promise<InvitationResponse> {
    const { rsvpStatus, plusOneCount = 0, specialRequirements } = rsvpData;

    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
      relations: ['event'],
      select: ['id', 'eventId', 'rsvpStatus', 'plusOneCount'],
    });

    if (!invitation) {
      throw new AppError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    // Check guest capacity for accepted invitations
    if (rsvpStatus === 'ACCEPTED') {
      const totalGuests = 1 + plusOneCount;
      const newTotalRsvp = invitation.event.currentRsvpCount + totalGuests;

      if (newTotalRsvp > invitation.event.maxGuests) {
        throw new AppError(
          'Cannot accept invitation: event would exceed maximum capacity',
          400,
          'CAPACITY_EXCEEDED'
        );
      }
    }

    // Update invitation
    const updatedInvitation = await database
      .getEntityManager()
      .transaction(async transactionalEntityManager => {
        const updated = await transactionalEntityManager.getRepository('Invitation').save(
          Object.assign(invitation, {
            rsvpStatus: rsvpStatus as any,
            rsvpAt: new Date(),
            plusOneCount,
            specialRequirements,
          })
        );

        // Update event RSVP count
        if (rsvpStatus === 'ACCEPTED') {
          const event = await transactionalEntityManager
            .getRepository('Event')
            .findOne({ where: { id: invitation.eventId } });
          if (event) {
            event.currentRsvpCount = (event.currentRsvpCount || 0) + 1 + plusOneCount;
            await transactionalEntityManager.getRepository('Event').save(event);
          }
        } else if (rsvpStatus === 'DECLINED' && invitation.rsvpStatus === 'ACCEPTED') {
          // If changing from accepted to declined, decrement count
          const event = await transactionalEntityManager
            .getRepository('Event')
            .findOne({ where: { id: invitation.eventId } });
          if (event) {
            event.currentRsvpCount = Math.max(
              0,
              (event.currentRsvpCount || 0) - 1 - (invitation.plusOneCount || 0)
            );
            await transactionalEntityManager.getRepository('Event').save(event);
          }
        }

        return updated;
      });

    logger.info(`RSVP updated: ${invitationId} - ${rsvpStatus}`);

    return this.formatInvitationResponse(updatedInvitation);
  }

  /**
   * Check-in guest using QR code
   */
  async checkInGuest(qrCode: string): Promise<InvitationResponse> {
    const invitation = await this.invitationRepository.findOne({
      where: { qrCode },
      relations: ['event'],
    });

    if (!invitation) {
      throw new AppError('Invalid QR code', 404, 'INVALID_QR_CODE');
    }

    if (invitation.rsvpStatus !== 'ACCEPTED') {
      throw new AppError('Guest has not confirmed attendance', 400, 'RSVP_NOT_CONFIRMED');
    }

    if (invitation.checkInTime) {
      throw new AppError('Guest has already checked in', 400, 'ALREADY_CHECKED_IN');
    }

    // Check if event is today or in the past
    const eventDate = new Date(invitation.event.eventDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (eventDate > today) {
      throw new AppError('Check-in is not available yet', 400, 'EARLY_CHECK_IN');
    }

    // Update check-in time
    invitation.checkInTime = new Date();
    const updatedInvitation = await this.invitationRepository.save(invitation);

    logger.info(`Guest checked in: ${invitation.id} - ${invitation.guestName}`);

    return this.formatInvitationResponse(updatedInvitation);
  }

  /**
   * Resend invitation
   */
  async resendInvitation(invitationId: string, userId: string): Promise<{ message: string }> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
      relations: ['event'],
    });

    if (!invitation) {
      throw new AppError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    if (invitation.event.userId !== userId) {
      throw new AppError('Access denied to this invitation', 403, 'INVITATION_ACCESS_DENIED');
    }

    await this.sendInvitation(invitation.id, invitation.event.title, invitation.event.eventDate);

    logger.info(`Invitation resent: ${invitationId}`);

    return { message: 'Invitation resent successfully' };
  }

  /**
   * Import guests from CSV
   */
  async importGuestsFromCSV(
    eventId: string,
    userId: string,
    filePath: string
  ): Promise<{
    successful: InvitationResponse[];
    failed: Array<{ row: any; error: string }>;
  }> {
    // Verify event ownership
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      select: ['userId'],
    });

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    if (event.userId !== userId) {
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    const guests: any[] = [];
    const successful: InvitationResponse[] = [];
    const failed: Array<{ row: any; error: string }> = [];

    // Read CSV file
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', row => {
          guests.push(row);
        })
        .on('end', async () => {
          try {
            // Process each guest
            for (const guest of guests) {
              try {
                // Map CSV columns to invitation data
                const invitationData: CreateInvitationRequest = {
                  eventId,
                  guestName: guest.name || guest.guestName || guest['Guest Name'],
                  guestEmail: guest.email || guest.guestEmail || guest['Email'],
                  guestPhone: guest.phone || guest.guestPhone || guest['Phone'],
                  invitationMethod: (
                    guest.method ||
                    guest.invitationMethod ||
                    guest['Invitation Method'] ||
                    'EMAIL'
                  ).toUpperCase() as any,
                  specialRequirements:
                    guest.requirements ||
                    guest.specialRequirements ||
                    guest['Special Requirements'],
                };

                // Validate required fields
                if (!invitationData.guestName) {
                  throw new Error('Guest name is required');
                }

                const invitation = await this.createInvitation(userId, invitationData);
                successful.push(invitation);
              } catch (error) {
                failed.push({
                  row: guest,
                  error: error instanceof Error ? error.message : 'Unknown error',
                });
              }
            }

            // Clean up temporary file
            fs.unlinkSync(filePath);

            logger.info(
              `CSV import completed: ${successful.length} successful, ${failed.length} failed`
            );

            resolve({ successful, failed });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', error => {
          reject(error);
        });
    });
  }

  /**
   * Export guest list to CSV
   */
  async exportGuestListToCSV(eventId: string, userId: string): Promise<string> {
    // Verify event ownership
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      select: ['userId', 'title'],
    });

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    if (event.userId !== userId) {
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    // Get all invitations for the event
    const invitations = await this.invitationRepository.find({
      where: { eventId },
      order: { guestName: 'ASC' },
    });

    // Create CSV file
    const fileName = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}_guest_list_${Date.now()}.csv`;
    const filePath = path.join(process.cwd(), 'uploads', 'temp', fileName);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'guestName', title: 'Guest Name' },
        { id: 'guestEmail', title: 'Email' },
        { id: 'guestPhone', title: 'Phone' },
        { id: 'invitationMethod', title: 'Invitation Method' },
        { id: 'rsvpStatus', title: 'RSVP Status' },
        { id: 'plusOneCount', title: 'Plus One Count' },
        { id: 'checkInTime', title: 'Check-in Time' },
        { id: 'specialRequirements', title: 'Special Requirements' },
        { id: 'sentAt', title: 'Invitation Sent' },
        { id: 'rsvpAt', title: 'RSVP Date' },
      ],
    });

    const records = invitations.map((invitation: any) => ({
      guestName: invitation.guestName,
      guestEmail: invitation.guestEmail || '',
      guestPhone: invitation.guestPhone || '',
      invitationMethod: invitation.invitationMethod,
      rsvpStatus: invitation.rsvpStatus,
      plusOneCount: invitation.plusOneCount,
      checkInTime: invitation.checkInTime ? invitation.checkInTime.toISOString() : '',
      specialRequirements: invitation.specialRequirements || '',
      sentAt: invitation.sentAt ? invitation.sentAt.toISOString() : '',
      rsvpAt: invitation.rsvpAt ? invitation.rsvpAt.toISOString() : '',
    }));

    await csvWriter.writeRecords(records);

    logger.info(`Guest list exported: ${eventId} - ${fileName}`);

    return fileName;
  }

  /**
   * Send invitation via appropriate channel
   */
  private async sendInvitation(
    invitationId: string,
    eventTitle: string,
    eventDate: Date
  ): Promise<void> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
      relations: ['event', 'event.user'],
    });

    if (!invitation) {
      throw new AppError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    const organizerName =
      invitation.event.user.companyName ||
      `${invitation.event.user.firstName} ${invitation.event.user.lastName}`;

    const rsvpLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/rsvp/${invitation.qrCode}`;

    try {
      let result;

      switch (invitation.invitationMethod) {
        case 'EMAIL':
          if (invitation.guestEmail) {
            result = await communicationService.sendInvitationEmail(
              invitation.guestEmail,
              eventTitle,
              eventDate,
              rsvpLink,
              organizerName
            );
          }
          break;

        case 'SMS':
          if (invitation.guestPhone) {
            result = await communicationService.sendInvitationSMS(
              invitation.guestPhone,
              eventTitle,
              eventDate,
              rsvpLink,
              organizerName
            );
          }
          break;

        case 'WHATSAPP':
          if (invitation.guestPhone) {
            result = await communicationService.sendInvitationWhatsApp(
              invitation.guestPhone,
              eventTitle,
              eventDate,
              rsvpLink,
              organizerName
            );
          }
          break;
      }

      // Update invitation status
      await this.invitationRepository.save(
        Object.assign(invitation, {
          sentAt: new Date(),
          deliveryStatus:
            result && result[0]?.status === 'SENT' ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
        })
      );
    } catch (error) {
      // Update invitation status as failed
      await this.invitationRepository.save(
        Object.assign(invitation, {
          deliveryStatus: DeliveryStatus.FAILED,
        })
      );

      logger.error(`Failed to send invitation ${invitationId}:`, error);
    }
  }

  /**
   * Generate unique QR code
   */
  private generateQRCode(): string {
    return `qr_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Get invitation by QR code (for public RSVP page)
   */
  async getInvitationByQR(qrCode: string): Promise<any> {
    const invitation = await this.invitationRepository.findOne({
      where: { qrCode },
      relations: ['event', 'event.user'],
    });

    if (!invitation) {
      throw new AppError('Invalid invitation link', 404, 'INVALID_INVITATION');
    }

    const organizerName =
      invitation.event.user.companyName ||
      `${invitation.event.user.firstName} ${invitation.event.user.lastName}`;

    return {
      ...this.formatInvitationResponse(invitation),
      event: {
        ...invitation.event,
        organizer: organizerName,
      },
    };
  }

  /**
   * Get invitation statistics for an event
   */
  async getInvitationStats(eventId: string, userId: string): Promise<any> {
    // Verify event ownership
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      select: ['userId'],
    });

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    if (event.userId !== userId) {
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    // Get invitation statistics using query builder
    const stats = await this.invitationRepository
      .createQueryBuilder('invitation')
      .select([
        'invitation.rsvpStatus',
        'invitation.deliveryStatus',
        'invitation.invitationMethod',
        'COUNT(*) as count',
      ])
      .where('invitation.eventId = :eventId', { eventId })
      .groupBy('invitation.rsvpStatus, invitation.deliveryStatus, invitation.invitationMethod')
      .getRawMany();

    // Calculate totals
    const summary = {
      total: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      pending: 0,
      accepted: 0,
      declined: 0,
      checkedIn: 0,
      byMethod: {
        email: { sent: 0, delivered: 0, failed: 0 },
        sms: { sent: 0, delivered: 0, failed: 0 },
        whatsapp: { sent: 0, delivered: 0, failed: 0 },
      },
    };

    stats.forEach((stat: any) => {
      const count = parseInt(stat.count);
      summary.total += count;

      // RSVP status
      if (stat.invitation_rsvpStatus === 'ACCEPTED') summary.accepted += count;
      if (stat.invitation_rsvpStatus === 'DECLINED') summary.declined += count;
      if (stat.invitation_rsvpStatus === 'PENDING') summary.pending += count;

      // Delivery status
      if (stat.invitation_deliveryStatus === 'SENT') summary.sent += count;
      if (stat.invitation_deliveryStatus === 'DELIVERED') summary.delivered += count;
      if (stat.invitation_deliveryStatus === 'FAILED') summary.failed += count;

      // By method
      const method =
        stat.invitation_invitationMethod?.toLowerCase() as keyof typeof summary.byMethod;
      if (summary.byMethod[method]) {
        if (stat.invitation_deliveryStatus === 'SENT') summary.byMethod[method].sent += count;
        if (stat.invitation_deliveryStatus === 'DELIVERED')
          summary.byMethod[method].delivered += count;
        if (stat.invitation_deliveryStatus === 'FAILED') summary.byMethod[method].failed += count;
      }
    });

    // Get check-in count
    summary.checkedIn = await this.invitationRepository.count({
      where: {
        eventId,
        checkInTime: Not(IsNull()),
      },
    });

    return summary;
  }

  /**
   * Send reminders to pending guests
   */
  async sendReminders(eventId: string, userId: string): Promise<{ sent: number; failed: number }> {
    // Verify event ownership
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      select: ['userId', 'title', 'eventDate'],
    });

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    if (event.userId !== userId) {
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    // Get pending invitations
    const pendingInvitations = await this.invitationRepository.find({
      where: {
        eventId,
        rsvpStatus: RSVPStatus.PENDING,
        deliveryStatus: In([DeliveryStatus.SENT, DeliveryStatus.DELIVERED]),
      }, // Only resend to successfully delivered invitations
    });

    let sent = 0;
    let failed = 0;

    for (const invitation of pendingInvitations) {
      try {
        await this.sendInvitation(invitation.id, event.title, event.eventDate);
        sent++;
      } catch (error) {
        failed++;
        logger.error(`Failed to send reminder for invitation ${invitation.id}:`, error);
      }
    }

    logger.info(`Reminders sent for event ${eventId}: ${sent} successful, ${failed} failed`);

    return { sent, failed };
  }

  /**
   * Delete invitation
   */
  async deleteInvitation(invitationId: string, userId: string): Promise<{ message: string }> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
      relations: ['event'],
    });

    if (!invitation) {
      throw new AppError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    if (invitation.event.userId !== userId) {
      throw new AppError('Access denied to this invitation', 403, 'INVITATION_ACCESS_DENIED');
    }

    // Update event RSVP count if invitation was accepted
    if (invitation.rsvpStatus === RSVPStatus.ACCEPTED) {
      const event = await this.eventRepository.findOne({ where: { id: invitation.eventId } });
      if (event) {
        event.currentRsvpCount = Math.max(
          0,
          (event.currentRsvpCount || 0) - 1 - (invitation.plusOneCount || 0)
        );
        await this.eventRepository.save(event);
      }
    }

    // Delete invitation
    await this.invitationRepository.delete({ id: invitationId });

    logger.info(`Invitation deleted: ${invitationId}`);

    return { message: 'Invitation deleted successfully' };
  }

  /**
   * Format invitation response
   */
  private formatInvitationResponse(invitation: any): InvitationResponse {
    return {
      id: invitation.id,
      eventId: invitation.eventId,
      guestName: invitation.guestName,
      guestEmail: invitation.guestEmail,
      guestPhone: invitation.guestPhone,
      invitationMethod: invitation.invitationMethod,
      sentAt: invitation.sentAt,
      deliveryStatus: invitation.deliveryStatus,
      rsvpStatus: invitation.rsvpStatus,
      rsvpAt: invitation.rsvpAt,
      plusOneCount: invitation.plusOneCount,
      qrCode: invitation.qrCode,
      checkInTime: invitation.checkInTime,
      specialRequirements: invitation.specialRequirements,
    };
  }
}

export default new InvitationService();
