import { Request, Response, NextFunction } from 'express';
import eventService from '../services/eventService';
import { ApiResponse, AuthenticatedRequest, CreateEventRequest } from '../types';
import { catchAsync } from '../middleware/errorHandler';

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
}

export default new EventController();
