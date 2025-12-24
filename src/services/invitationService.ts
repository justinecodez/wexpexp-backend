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

import communicationService from './communicationService';
import QRCode from 'qrcode';
import crypto from 'crypto';
import logger from '../config/logger';
import { createObjectCsvWriter } from 'csv-writer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';

import { storageService } from './storageService';
import * as XLSX from 'xlsx';
import { normalizePhone, isValidPhone } from '../utils/phoneUtils';

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

    // Use centralized phone normalization
    const formattedPhone = guestPhone ? normalizePhone(guestPhone) : '';

    // Validate contact information based on method
    if (invitationMethod === 'EMAIL' && !guestEmail) {
      throw new AppError('Email is required for email invitations', 400, 'EMAIL_REQUIRED');
    }

    if ((invitationMethod === 'SMS' || invitationMethod === 'WHATSAPP') && !formattedPhone) {
      throw new AppError(
        'A valid phone number is required for SMS/WhatsApp invitations',
        400,
        'PHONE_REQUIRED'
      );
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

    // Generate unique check-in code
    const checkInCode = await this.generateCheckInCode();

    // Create invitation
    const invitation = this.invitationRepository.create({
      eventId,
      guestName,
      guestEmail: guestEmail?.toLowerCase(),
      guestPhone: formattedPhone,
      invitationMethod: invitationMethod as any,
      qrCode,
      qrCodeUrl: qrCodeDataUrl, // Save QR code image data URL
      checkInCode, // Add 6-digit check-in code
      specialRequirements,
      deliveryStatus: DeliveryStatus.PENDING,
      rsvpStatus: RSVPStatus.PENDING,
    });

    const savedInvitation = await this.invitationRepository.save(invitation);

    // Auto-send disabled - users must manually send invitations via Communications tab
    // await this.sendInvitation(savedInvitation.id, event.title, event.eventDate);

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
   * Update invitation details
   */
  async updateInvitation(
    invitationId: string,
    userId: string,
    updateData: {
      guestName?: string;
      guestEmail?: string;
      guestPhone?: string;
      invitationMethod?: InvitationMethod;
      specialRequirements?: string;
    }
  ): Promise<InvitationResponse> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
      relations: ['event'],
    });

    if (!invitation) {
      throw new AppError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    // Verify event ownership
    if (invitation.event.userId !== userId) {
      throw new AppError('Access denied to this invitation', 403, 'INVITATION_ACCESS_DENIED');
    }

    // Validate contact information based on method if being updated
    if (updateData.invitationMethod) {
      if (updateData.invitationMethod === InvitationMethod.EMAIL && !updateData.guestEmail) {
        throw new AppError('Email is required for email invitations', 400, 'EMAIL_REQUIRED');
      }

      if ((updateData.invitationMethod === InvitationMethod.SMS ||
        updateData.invitationMethod === InvitationMethod.WHATSAPP) && !updateData.guestPhone) {
        throw new AppError(
          'Phone number is required for SMS/WhatsApp invitations',
          400,
          'PHONE_REQUIRED'
        );
      }
    }

    // Check for duplicate email/phone if being updated
    if (updateData.guestEmail || updateData.guestPhone) {
      const queryBuilder = this.invitationRepository
        .createQueryBuilder('invitation')
        .where('invitation.eventId = :eventId', { eventId: invitation.eventId })
        .andWhere('invitation.id != :invitationId', { invitationId });

      const conditions = [];
      const parameters: any = {};

      if (updateData.guestEmail) {
        conditions.push('invitation.guestEmail = :email');
        parameters.email = updateData.guestEmail.toLowerCase();
      }

      if (updateData.guestPhone) {
        conditions.push('invitation.guestPhone = :phone');
        parameters.phone = updateData.guestPhone.trim();
      }

      if (conditions.length > 0) {
        queryBuilder.andWhere(`(${conditions.join(' OR ')})`, parameters);
        const existingInvitation = await queryBuilder.getOne();

        if (existingInvitation) {
          throw new AppError(
            'Another guest with this email or phone is already invited to this event',
            409,
            'DUPLICATE_INVITATION'
          );
        }
      }
    }

    // Update invitation
    Object.assign(invitation, {
      guestName: updateData.guestName || invitation.guestName,
      guestEmail: updateData.guestEmail?.toLowerCase() || invitation.guestEmail,
      guestPhone: updateData.guestPhone?.trim() || invitation.guestPhone,
      invitationMethod: updateData.invitationMethod || invitation.invitationMethod,
      specialRequirements: updateData.specialRequirements !== undefined
        ? updateData.specialRequirements
        : invitation.specialRequirements,
      updatedAt: new Date(),
    });

    const updatedInvitation = await this.invitationRepository.save(invitation);

    logger.info(`Invitation updated: ${invitationId}`);

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

    // Allow check-in regardless of RSVP status
    // This enables admins to manually check in walk-in guests or guests who didn't RSVP

    if (invitation.checkInTime) {
      throw new AppError('Guest has already checked in', 400, 'ALREADY_CHECKED_IN');
    }



    // Manual check-in is allowed at any time (no date restriction)
    // This allows event organizers to check in guests regardless of event date

    // Update check-in time and auto-accept RSVP if not already accepted
    const updatedInvitation = await database
      .getEntityManager()
      .transaction(async transactionalEntityManager => {
        // If guest hasn't RSVP'd, automatically accept their attendance when checking in
        const wasAccepted = invitation.rsvpStatus === 'ACCEPTED';

        invitation.checkInTime = new Date();

        if (!wasAccepted) {
          invitation.rsvpStatus = RSVPStatus.ACCEPTED as any;
          invitation.rsvpAt = new Date();

          // Update event RSVP count
          const event = await transactionalEntityManager
            .getRepository('Event')
            .findOne({ where: { id: invitation.eventId } });

          if (event) {
            event.currentRsvpCount = (event.currentRsvpCount || 0) + 1 + (invitation.plusOneCount || 0);
            await transactionalEntityManager.getRepository('Event').save(event);
          }
        }

        return await transactionalEntityManager.getRepository('Invitation').save(invitation);
      });

    logger.info(`Guest checked in: ${invitation.id} - ${invitation.guestName}`);

    return this.formatInvitationResponse(updatedInvitation);
  }

  /**
   * Check-in guest using 6-digit check-in code (for non-smartphone users)
   */
  async checkInGuestByCode(checkInCode: string): Promise<InvitationResponse> {
    const invitation = await this.invitationRepository.findOne({
      where: { checkInCode },
      relations: ['event'],
    });

    if (!invitation) {
      throw new AppError('Invalid check-in code', 404, 'INVALID_CHECK_IN_CODE');
    }

    if (invitation.checkInTime) {
      throw new AppError('Guest has already checked in', 400, 'ALREADY_CHECKED_IN');
    }

    // Update check-in time and auto-accept RSVP if not already accepted
    const updatedInvitation = await database
      .getEntityManager()
      .transaction(async transactionalEntityManager => {
        const wasAccepted = invitation.rsvpStatus === 'ACCEPTED';

        invitation.checkInTime = new Date();

        if (!wasAccepted) {
          invitation.rsvpStatus = RSVPStatus.ACCEPTED as any;
          invitation.rsvpAt = new Date();

          // Update event RSVP count
          const event = await transactionalEntityManager
            .getRepository('Event')
            .findOne({ where: { id: invitation.eventId } });

          if (event) {
            event.currentRsvpCount = (event.currentRsvpCount || 0) + 1 + (invitation.plusOneCount || 0);
            await transactionalEntityManager.getRepository('Event').save(event);
          }
        }

        return await transactionalEntityManager.getRepository('Invitation').save(invitation);
      });

    logger.info(`Guest checked in by code: ${invitation.id} - ${invitation.guestName} - Code: ${checkInCode}`);

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
                  guestPhone: normalizePhone(guest.phone || guest.guestPhone || guest['Phone']),
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
   * Import guests from Excel
   */
  async importGuestsFromExcel(
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
      logger.warn(`Permission denied for import: User ${userId} attempting to import to event ${eventId} owned by ${event.userId}`);
      throw new AppError('Access denied to this event', 403, 'EVENT_ACCESS_DENIED');
    }

    logger.info(`Permission verified for import: User ${userId} to event ${eventId}`);

    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const guests = XLSX.utils.sheet_to_json(sheet);

      const successful: InvitationResponse[] = [];
      const failed: Array<{ row: any; error: string }> = [];

      logger.info(`Starting Excel import for event: ${eventId} with ${guests.length} potential guests`);

      for (const guest of guests as any[]) {
        try {
          // Map Excel columns to invitation data (with fallback names)
          const guestName = guest.name || guest.guestName || guest['Guest Name'] || guest['Name'];
          const guestEmail = guest.email || guest.guestEmail || guest['Email'];
          const guestPhoneRaw = guest.phone || guest.guestPhone || guest['Phone'];
          const methodRaw = guest.method || guest.invitationMethod || guest['Invitation Method'] || 'EMAIL';
          const specialRequirements = guest.requirements || guest.specialRequirements || guest['Special Requirements'] || guest['Note'];

          if (!guestName) {
            throw new Error('Guest name is required');
          }

          const invitationData: CreateInvitationRequest = {
            eventId,
            guestName: String(guestName).trim(),
            guestEmail: guestEmail ? String(guestEmail).trim().toLowerCase() : undefined,
            guestPhone: normalizePhone(guestPhoneRaw),
            invitationMethod: methodRaw.toString().toUpperCase() as any,
            specialRequirements: specialRequirements ? String(specialRequirements).trim() : undefined,
          };

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
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      logger.info(
        `Excel import completed for event ${eventId}: ${successful.length} successful, ${failed.length} failed`
      );

      return { successful, failed };
    } catch (error) {
      logger.error('Error parsing Excel file', { eventId, error });
      throw new AppError('Failed to parse Excel file', 400, 'EXCEL_PARSE_ERROR');
    }
  }

  /**
   * Generate guest list Excel template
   */
  async generateGuestTemplate(): Promise<string> {
    const fileName = `wexp_guest_import_template_${Date.now()}.xlsx`;
    const filePath = path.join(process.cwd(), 'uploads', 'temp', fileName);

    // Create a new workbook
    const wb = XLSX.utils.book_new();

    // Sample data for the template
    const templateData = [
      {
        'Guest Name': 'John Doe',
        'Email': 'john@example.com',
        'Phone': '255700000000',
        'Invitation Method': 'EMAIL',
        'Special Requirements': 'Vegetarian'
      },
      {
        'Guest Name': 'Jane Doe',
        'Email': 'jane@example.com',
        'Phone': '255711111111',
        'Invitation Method': 'WHATSAPP',
        'Special Requirements': 'Needs parking space'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);

    // Add columns widths for better visibility
    ws['!cols'] = [
      { wch: 25 }, // Name
      { wch: 25 }, // Email
      { wch: 15 }, // Phone
      { wch: 20 }, // Method
      { wch: 30 }  // Requirements
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Guests');

    // Write the file
    XLSX.writeFile(wb, filePath);

    return fileName;
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
   * Generate unique 6-digit check-in code
   */
  private async generateCheckInCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 10;

    while (!isUnique && attempts < MAX_ATTEMPTS) {
      // Generate random 6-digit number
      code = Math.floor(100000 + Math.random() * 900000).toString();

      // Check if code already exists
      const existing = await this.invitationRepository.findOne({
        where: { checkInCode: code },
      });

      if (!existing) {
        isUnique = true;
        return code;
      }

      attempts++;
    }

    // Fallback: if we can't generate after MAX_ATTEMPTS, throw error
    throw new AppError('Unable to generate unique check-in code', 500, 'CODE_GENERATION_FAILED');
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
      throw new AppError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    return this.formatInvitationResponse(invitation);
  }

  /**
   * Upload invitation card
   */
  async uploadCard(
    invitationId: string,
    userId: string,
    imageData: string
  ): Promise<{ cardUrl: string }> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
      relations: ['event'],
    });

    if (!invitation) {
      throw new AppError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    // Verify event ownership
    if (invitation.event.userId !== userId) {
      throw new AppError('Access denied to this invitation', 403, 'INVITATION_ACCESS_DENIED');
    }

    // Process base64 image
    const matches = imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new AppError('Invalid image data', 400, 'INVALID_IMAGE_DATA');
    }

    const type = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const extension = type.split('/')[1];
    const fileName = `cards/${invitation.eventId}/${invitation.id}_${Date.now()}.${extension}`;

    // Upload to storage
    console.log(`🚀 Starting upload to storage bucket for file: ${fileName}`);
    const cardUrl = await storageService.uploadFile(buffer, fileName, type);

    // Update invitation with card URL
    invitation.cardUrl = cardUrl;
    await this.invitationRepository.save(invitation);

    logger.info(`Card uploaded for invitation: ${invitationId}`);

    return { cardUrl };
  }

  /**
   * Update invitation card URL and personalized message (called by worker)
   */
  async updateInvitationCardUrl(
    invitationId: string,
    cardUrl: string,
    personalizedMessage?: string
  ): Promise<any> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new AppError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    // Update card URL
    invitation.cardUrl = cardUrl;

    // Update personalized message if provided
    if (personalizedMessage !== undefined) {
      invitation.personalizedMessage = personalizedMessage;
    }

    await this.invitationRepository.save(invitation);

    logger.info(`Card URL and personalized message updated for invitation: ${invitationId}`);

    return this.formatInvitationResponse(invitation);
  }

  /**
   * Get invitation statistics for an event
   */
  async getInvitationStats(
    eventId: string,
    userId: string
  ): Promise<{
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    pending: number;
    accepted: number;
    declined: number;
    checkedIn: number;
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

    const stats = await this.invitationRepository
      .createQueryBuilder('invitation')
      .select([
        'COUNT(*) as total',
        "SUM(CASE WHEN delivery_status = 'SENT' THEN 1 ELSE 0 END) as sent",
        "SUM(CASE WHEN delivery_status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered",
        "SUM(CASE WHEN delivery_status = 'FAILED' THEN 1 ELSE 0 END) as failed",
        "SUM(CASE WHEN rsvp_status = 'PENDING' THEN 1 ELSE 0 END) as pending",
        "SUM(CASE WHEN rsvp_status = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted",
        "SUM(CASE WHEN rsvp_status = 'DECLINED' THEN 1 ELSE 0 END) as declined",
        'SUM(CASE WHEN check_in_time IS NOT NULL THEN 1 ELSE 0 END) as checkedIn',
      ])
      .where('event_id = :eventId', { eventId })
      .getRawOne();

    return {
      total: parseInt(stats.total) || 0,
      sent: parseInt(stats.sent) || 0,
      delivered: parseInt(stats.delivered) || 0,
      failed: parseInt(stats.failed) || 0,
      pending: parseInt(stats.pending) || 0,
      accepted: parseInt(stats.accepted) || 0,
      declined: parseInt(stats.declined) || 0,
      checkedIn: parseInt(stats.checkedIn) || 0,
    };
  }

  /**
   * Send reminders to pending guests
   */
  async sendReminders(
    eventId: string,
    userId: string
  ): Promise<{ sent: number; failed: number }> {
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
      },
      relations: ['event', 'event.user'],
    });

    let sent = 0;
    let failed = 0;

    for (const invitation of pendingInvitations) {
      try {
        await this.sendInvitation(invitation.id, event.title, event.eventDate);
        sent++;
      } catch (error) {
        failed++;
      }
    }

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

    // If invitation was accepted, update event RSVP count
    if (invitation.rsvpStatus === 'ACCEPTED') {
      const event = await this.eventRepository.findOne({ where: { id: invitation.eventId } });
      if (event) {
        event.currentRsvpCount = Math.max(
          0,
          (event.currentRsvpCount || 0) - 1 - (invitation.plusOneCount || 0)
        );
        await this.eventRepository.save(event);
      }
    }

    await this.invitationRepository.remove(invitation);

    logger.info(`Invitation deleted: ${invitationId}`);

    return { message: 'Invitation deleted successfully' };
  }

  /**
   * Format invitation response
   */
  private formatInvitationResponse(invitation: Invitation): InvitationResponse {
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
      checkInCode: invitation.checkInCode,
      checkInTime: invitation.checkInTime,
      specialRequirements: invitation.specialRequirements,
      cardUrl: invitation.cardUrl,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
    };
  }

  /**
   * Get invitations by IDs (for selective card regeneration)
   */
  async getInvitationsByIds(invitationIds: string[]): Promise<Invitation[]> {
    if (!invitationIds || invitationIds.length === 0) {
      return [];
    }

    return await this.invitationRepository.find({
      where: { id: In(invitationIds) },
      select: ['id', 'guestName', 'guestEmail', 'guestPhone', 'cardUrl', 'rsvpStatus', 'qrCode'],
    });
  }

  /**
   * Clear card URLs for invitations (before regeneration)
   */
  async clearCardUrls(invitationIds: string[]): Promise<void> {
    if (!invitationIds || invitationIds.length === 0) {
      return;
    }

    await this.invitationRepository.update(
      { id: In(invitationIds) },
      { cardUrl: undefined as any } // Set to undefined to clear
    );

    logger.info(`🧹 Cleared cardUrl for ${invitationIds.length} invitations`);
  }
}

export default new InvitationService();
