import { Request, Response, NextFunction } from 'express';
import calendarService from '../services/calendarService';
import { ApiResponse, AuthenticatedRequest } from '../types';
import { catchAsync } from '../middleware/errorHandler';

export class CalendarController {
  /**
   * Generate iCal feed
   */
  generateICalFeed = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const icalContent = await calendarService.generateICalFeed(req.user.userId);

    // Set headers for calendar download
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', 'attachment; filename="events.ics"');
    res.send(icalContent);
  });

  /**
   * Get Google Calendar auth URL
   */
  getGoogleAuthUrl = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const url = calendarService.getGoogleAuthUrl(req.user.userId);

    const response: ApiResponse = {
      success: true,
      data: { url },
    };

    res.status(200).json(response);
  });

  /**
   * Handle Google Calendar OAuth callback
   */
  handleGoogleCallback = catchAsync(async (req: Request, res: Response) => {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
      });
    }

    await calendarService.handleGoogleCallback(code as string, state as string);

    const response: ApiResponse = {
      success: true,
      message: 'Google Calendar connected successfully',
    };

    res.status(200).json(response);
  });

  /**
   * Sync event with Google Calendar
   */
  syncWithGoogleCalendar = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { eventId } = req.params;
    await calendarService.syncWithGoogleCalendar(req.user.userId, eventId);

    const response: ApiResponse = {
      success: true,
      message: 'Event synced with Google Calendar',
    };

    res.status(200).json(response);
  });
}

export default new CalendarController();
