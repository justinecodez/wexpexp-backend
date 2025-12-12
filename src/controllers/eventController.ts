import { Request, Response, NextFunction } from 'express';
import eventService from '../services/eventService';
import { ApiResponse, AuthenticatedRequest, CreateEventRequest } from '../types';
import { catchAsync } from '../middleware/errorHandler';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import s3Client, { s3Config } from '../config/s3.config';
import database from '../config/database';
import { Event } from '../entities/Event';
import { Invitation } from '../entities/Invitation';
import { redisClient } from '../queues/image.queue';

export class EventController {
  /**
   * Create a new event
   */
  createEvent = catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const event = await eventService.createEvent(req.user.userId, req.body as CreateEventRequest);

    const response: ApiResponse = {
      success: true,
      message: 'Event created successfully',
      data: { event },
    };

    res.status(201).json(response);
  });

  /**
   * Get user events with filtering and pagination
   */
  getUserEvents = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const filters = {
        status: req.query.status as string,
        eventType: req.query.eventType as string,
        venueCity: req.query.venueCity as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        search: req.query.search as string,
      };

      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sortBy: (req.query.sortBy as string) || 'createdAt',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const result = await eventService.getUserEvents(req.user.userId, filters, pagination);

      const response: ApiResponse = {
        success: true,
        data: result.events,
        pagination: result.pagination,
      };

      res.status(200).json(response);
    }
  );

  /**
   * Get public events
   */
  getPublicEvents = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const filters = {
      eventType: req.query.eventType as string,
      venueCity: req.query.venueCity as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      search: req.query.search as string,
    };

    const pagination = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      sortBy: (req.query.sortBy as string) || 'eventDate',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'asc',
    };

    const result = await eventService.getPublicEvents(filters, pagination);

    const response: ApiResponse = {
      success: true,
      data: result.events,
      pagination: result.pagination,
    };

    res.status(200).json(response);
  });

  /**
   * Get event by ID
   */
  getEventById = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const { id } = req.params;
      const userId = req.user?.userId;

      const event = await eventService.getEventById(id, userId);

      const response: ApiResponse = {
        success: true,
        data: { event },
      };

      res.status(200).json(response);
    }
  );

  /**
   * Update event
   */
  updateEvent = catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    console.log('=== CONTROLLER DEBUG ===');
    console.log('req.body:', JSON.stringify(req.body));

    const { id } = req.params;

    const event = await eventService.updateEvent(
      id,
      req.user.userId,
      req.body as Partial<CreateEventRequest>
    );

    const response: ApiResponse = {
      success: true,
      message: 'Event updated successfully',
      data: { event },
    };

    res.status(200).json(response);
  });

  /**
   * Delete event
   */
  deleteEvent = catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { id } = req.params;
    const result = await eventService.deleteEvent(id, req.user.userId);

    const response: ApiResponse = {
      success: true,
      message: result.message,
    };

    res.status(200).json(response);
  });

  /**
   * Duplicate event
   */
  duplicateEvent = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const { id } = req.params;
      const event = await eventService.duplicateEvent(id, req.user.userId);

      const response: ApiResponse = {
        success: true,
        message: 'Event duplicated successfully',
        data: { event },
      };

      res.status(201).json(response);
    }
  );

  /**
   * Get event analytics
   */
  getEventAnalytics = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const { id } = req.params;
      const analytics = await eventService.getEventAnalytics(id, req.user.userId);

      const response: ApiResponse = {
        success: true,
        data: { analytics },
      };

      res.status(200).json(response);
    }
  );

  /**
   * Update event status
   */
  updateEventStatus = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const { id } = req.params;
      const { status } = req.body as { status: string };

      if (!status || !['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Valid status is required (DRAFT, ACTIVE, COMPLETED, CANCELLED)',
        });
      }

      const event = await eventService.updateEvent(id, req.user.userId, {
        status,
      } as Partial<CreateEventRequest>);

      const response: ApiResponse = {
        success: true,
        message: 'Event status updated successfully',
        data: { event },
      };

      res.status(200).json(response);
    }
  );

  /**
   * Get event statistics for dashboard
   */
  getEventStats = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      // Get basic event counts
      const totalEvents = await eventService.getUserEvents(
        req.user.userId,
        {},
        { page: 1, limit: 1 }
      );

      const activeEvents = await eventService.getUserEvents(
        req.user.userId,
        { status: 'ACTIVE' },
        { page: 1, limit: 1 }
      );

      const upcomingEvents = await eventService.getUserEvents(
        req.user.userId,
        { startDate: new Date().toISOString() },
        { page: 1, limit: 5 }
      );

      const response: ApiResponse = {
        success: true,
        data: {
          totalEvents: totalEvents.pagination.total,
          activeEvents: activeEvents.pagination.total,
          upcomingEvents: upcomingEvents.events,
        },
      };

      res.status(200).json(response);
    }
  );

  /**
   * Get Presigned URL for Direct-to-Cloud Upload
   */
  getUploadUrl = catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { id } = req.params;
    const { type } = req.query;

    // 1. Validate Event Ownership
    const event = await eventService.getEventById(id, req.user.userId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    // 2. Generate File Key
    const fileExtension = (type as string)?.split('/')[1] || 'png';
    const key = `events/${id}/templates/${Date.now()}_bg.${fileExtension}`;

    // 3. Generate Presigned URL
    const command = new PutObjectCommand({
      Bucket: s3Config.bucketName,
      Key: key,
      ContentType: type as string,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes

    // 4. Construct Public URL (Backblaze B2 specific)
    // Format: https://<bucket>.<endpoint>/<key>
    // Note: Endpoint in config includes 'https://', so we strip it for the public URL construction if needed,
    // or just use the B2 friendly URL format.
    // B2 Friendly URL: https://f003.backblazeb2.com/file/<bucket>/<key>
    // However, the prompt suggested: https://<bucket>.<endpoint>/<key>
    // Let's use the standard S3 path style which is often supported or the B2 specific one.
    // Given the prompt's specific request: "https://<bucket>.<endpoint>/<key>"
    const endpoint = process.env.BACKBLAZE_B2_ENDPOINT || '';
    const publicUrl = `https://${s3Config.bucketName}.${endpoint}/${key}`;

    res.status(200).json({
      success: true,
      data: {
        uploadUrl,
        publicUrl,
      },
    });
  });

  /**
   * Save Template Configuration
   */
  saveTemplateConfig = catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { id } = req.params;
    const backendPayload = req.body;

    // 1. Validate Event Ownership
    const event = await eventService.getEventById(id, req.user.userId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    // 2. Update Event with Template Config
    // We use updateEvent service but pass the templateConfig
    // Since updateEvent expects Partial<CreateEventRequest>, we might need to cast or ensure service handles it.
    // Alternatively, we can call a specific method if we added one, or just use updateEvent if we update the type.
    // For now, I'll cast it to any to bypass strict type checking for this specific field if it's not in CreateEventRequest yet.
    await eventService.updateEvent(id, req.user.userId, {
      templateConfig: backendPayload,
    } as any);

    res.status(200).json({
      success: true,
      message: 'Template configuration saved successfully',
    });
  });

  /**
   * Trigger Invitation Generation
   */
  triggerGeneration = catchAsync(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { id } = req.params;

    // 1. Fetch Event and Guests directly to get templateConfig
    const eventRepository = database.getRepository(Event);
    const event = await eventRepository.findOne({
      where: { id },
      relations: ['invitations']
    });

    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    // 2. Validate Ownership
    if (event.userId !== req.user.userId) {
      return res.status(403).json({ success: false, error: 'Access denied to this event' });
    }

    // 3. Validate Template Config
    if (!event.templateConfig) {
      return res.status(400).json({ success: false, error: 'Template configuration not found. Please save a template first.' });
    }

    // 4. Fan-Out: Create Jobs for each guest
    const guests = event.invitations || [];

    // Push jobs to Redis List 'invitation_queue'
    const pipeline = redisClient.pipeline();

    guests.forEach((guest: Invitation) => {
      const jobData = {
        jobId: `evt_${event.id}_guest_${guest.id}`,
        eventId: event.id,
        invitationId: guest.id,
        guestName: guest.guestName,
        guestEmail: guest.guestEmail,
        guestData: {
          name: guest.guestName,
          email: guest.guestEmail,
          phone: guest.guestPhone,
          date: event.startDate, // Assuming event has startDate
          venue: event.venueName, // Assuming event has venueName
          city: event.venueCity,
        },
        templateConfig: event.templateConfig,
        s3Config: {
          bucketName: s3Config.bucketName,
          endpoint: process.env.BACKBLAZE_B2_ENDPOINT,
          region: s3Config.region
        }
      };

      pipeline.rpush('invitation_queue', JSON.stringify(jobData));
    });

    if (guests.length > 0) {
      await pipeline.exec();
    }

    res.status(200).json({
      success: true,
      count: guests.length,
      message: `Generation started for ${guests.length} guests`
    });
  });
}

export default new EventController();
