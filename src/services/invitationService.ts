import { prisma } from '../config/database';
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
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        userId: true,
        title: true,
        eventDate: true,
        maxGuests: true,
        currentRsvpCount: true,
      },
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
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        eventId,
        OR: [{ guestEmail: guestEmail?.toLowerCase() }, { guestPhone: formattedPhone }],
      },
    });

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
    const invitation = await prisma.invitation.create({
      data: {
        eventId,
        guestName,
        guestEmail: guestEmail?.toLowerCase(),
        guestPhone: formattedPhone,
        invitationMethod: invitationMethod as any,
        qrCode,
        specialRequirements,
        deliveryStatus: 'PENDING',
        rsvpStatus: 'PENDING',
      },
    });

    // Send invitation
    await this.sendInvitation(invitation.id, event.title, event.eventDate);

    logger.info(`Invitation created: ${invitation.id} for event: ${eventId}`);

    return this.formatInvitationResponse(invitation);
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
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        userId: true,
        title: true,
        eventDate: true,
        maxGuests: true,
        currentRsvpCount: true,
      },
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
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { userId: true },
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

    if (filters?.search) {
      where.OR = [
        { guestName: { contains: filters.search, mode: 'insensitive' } },
        { guestEmail: { contains: filters.search, mode: 'insensitive' } },
        { guestPhone: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await prisma.invitation.count({ where });

    // Get invitations
    const invitations = await prisma.invitation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
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

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        event: {
          select: { maxGuests: true, currentRsvpCount: true },
        },
      },
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
    const updatedInvitation = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.invitation.update({
        where: { id: invitationId },
        data: {
          rsvpStatus: rsvpStatus as any,
          rsvpAt: new Date(),
          plusOneCount,
          specialRequirements,
        },
      });

      // Update event RSVP count
      if (rsvpStatus === 'ACCEPTED') {
        await tx.event.update({
          where: { id: invitation.eventId },
          data: {
            currentRsvpCount: {
              increment: 1 + plusOneCount,
            },
          },
        });
      } else if (rsvpStatus === 'DECLINED' && invitation.rsvpStatus === 'ACCEPTED') {
        // If changing from accepted to declined, decrement count
        await tx.event.update({
          where: { id: invitation.eventId },
          data: {
            currentRsvpCount: {
              decrement: 1 + invitation.plusOneCount,
            },
          },
        });
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
    const invitation = await prisma.invitation.findUnique({
      where: { qrCode },
      include: {
        event: {
          select: { title: true, eventDate: true },
        },
      },
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
    const updatedInvitation = await prisma.invitation.update({
      where: { id: invitation.id },
      data: { checkInTime: new Date() },
    });

    logger.info(`Guest checked in: ${invitation.id} - ${invitation.guestName}`);

    return this.formatInvitationResponse(updatedInvitation);
  }

  /**
   * Resend invitation
   */
  async resendInvitation(invitationId: string, userId: string): Promise<{ message: string }> {
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        event: {
          select: { userId: true, title: true, eventDate: true },
        },
      },
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
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { userId: true },
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
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { userId: true, title: true },
    });

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    if (event.userId !== userId) {
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    // Get all invitations for the event
    const invitations = await prisma.invitation.findMany({
      where: { eventId },
      orderBy: { guestName: 'asc' },
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
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        event: {
          include: {
            user: {
              select: { firstName: true, lastName: true, companyName: true },
            },
          },
        },
      },
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
      await prisma.invitation.update({
        where: { id: invitationId },
        data: {
          sentAt: new Date(),
          deliveryStatus: result && result[0]?.status === 'SENT' ? 'SENT' : 'FAILED',
        },
      });
    } catch (error) {
      // Update invitation status as failed
      await prisma.invitation.update({
        where: { id: invitationId },
        data: {
          deliveryStatus: 'FAILED',
        },
      });

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
    const invitation = await prisma.invitation.findUnique({
      where: { qrCode },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            description: true,
            eventDate: true,
            startTime: true,
            endTime: true,
            venueName: true,
            venueAddress: true,
            venueCity: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                companyName: true,
              },
            },
          },
        },
      },
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
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { userId: true },
    });

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    if (event.userId !== userId) {
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    // Get invitation statistics
    const stats = await prisma.invitation.groupBy({
      by: ['rsvpStatus', 'deliveryStatus', 'invitationMethod'],
      where: { eventId },
      _count: true,
    });

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
      summary.total += stat._count;

      // RSVP status
      if (stat.rsvpStatus === 'ACCEPTED') summary.accepted += stat._count;
      if (stat.rsvpStatus === 'DECLINED') summary.declined += stat._count;
      if (stat.rsvpStatus === 'PENDING') summary.pending += stat._count;

      // Delivery status
      if (stat.deliveryStatus === 'SENT') summary.sent += stat._count;
      if (stat.deliveryStatus === 'DELIVERED') summary.delivered += stat._count;
      if (stat.deliveryStatus === 'FAILED') summary.failed += stat._count;

      // By method
      const method = stat.invitationMethod.toLowerCase() as keyof typeof summary.byMethod;
      if (summary.byMethod[method]) {
        if (stat.deliveryStatus === 'SENT') summary.byMethod[method].sent += stat._count;
        if (stat.deliveryStatus === 'DELIVERED') summary.byMethod[method].delivered += stat._count;
        if (stat.deliveryStatus === 'FAILED') summary.byMethod[method].failed += stat._count;
      }
    });

    // Get check-in count
    summary.checkedIn = await prisma.invitation.count({
      where: {
        eventId,
        checkInTime: { not: null },
      },
    });

    return summary;
  }

  /**
   * Send reminders to pending guests
   */
  async sendReminders(eventId: string, userId: string): Promise<{ sent: number; failed: number }> {
    // Verify event ownership
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { userId: true, title: true, eventDate: true },
    });

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    if (event.userId !== userId) {
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    // Get pending invitations
    const pendingInvitations = await prisma.invitation.findMany({
      where: {
        eventId,
        rsvpStatus: 'PENDING',
        deliveryStatus: { in: ['SENT', 'DELIVERED'] }, // Only resend to successfully delivered invitations
      },
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
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        event: {
          select: { userId: true },
        },
      },
    });

    if (!invitation) {
      throw new AppError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    if (invitation.event.userId !== userId) {
      throw new AppError('Access denied to this invitation', 403, 'INVITATION_ACCESS_DENIED');
    }

    // Update event RSVP count if invitation was accepted
    if (invitation.rsvpStatus === 'ACCEPTED') {
      await prisma.event.update({
        where: { id: invitation.eventId },
        data: {
          currentRsvpCount: {
            decrement: 1 + invitation.plusOneCount,
          },
        },
      });
    }

    // Delete invitation
    await prisma.invitation.delete({
      where: { id: invitationId },
    });

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
