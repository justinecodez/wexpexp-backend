import { Request, Response, NextFunction } from 'express';
import invitationService from '../services/invitationService';
import {
  ApiResponse,
  AuthenticatedRequest,
  CreateInvitationRequest,
  BulkInvitationRequest,
} from '../types';
import { catchAsync } from '../middleware/errorHandler';
import path from 'path';

export class InvitationController {
  /**
   * Create a single invitation
   */
  createInvitation = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const invitation = await invitationService.createInvitation(
        req.user.userId,
        req.body as CreateInvitationRequest
      );

      const response: ApiResponse = {
        success: true,
        message: 'Invitation created successfully',
        data: { invitation },
      };

      res.status(201).json(response);
    }
  );

  /**
   * Create bulk invitations
   */
  createBulkInvitations = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const result = await invitationService.createBulkInvitations(
        req.user.userId,
        req.body as BulkInvitationRequest
      );

      const response: ApiResponse = {
        success: true,
        message: `Bulk invitations processed: ${result.successful.length} successful, ${result.failed.length} failed`,
        data: result,
      };

      res.status(201).json(response);
    }
  );

  /**
   * Get invitations for an event
   */
  getEventInvitations = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const { eventId } = req.params;

      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sortBy: (req.query.sortBy as string) || 'createdAt',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const filters = {
        rsvpStatus: req.query.rsvpStatus as string,
        deliveryStatus: req.query.deliveryStatus as string,
        invitationMethod: req.query.invitationMethod as string,
        search: req.query.search as string,
      };

      const result = await invitationService.getEventInvitations(
        eventId,
        req.user.userId,
        pagination,
        filters
      );

      const response: ApiResponse = {
        success: true,
        data: result.invitations,
        pagination: result.pagination,
      };

      res.status(200).json(response);
    }
  );

  /**
   * Update invitation details
   */
  updateInvitation = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const { id } = req.params;
      const invitation = await invitationService.updateInvitation(
        id,
        req.user.userId,
        req.body
      );

      const response: ApiResponse = {
        success: true,
        message: 'Invitation updated successfully',
        data: { invitation },
      };

      res.status(200).json(response);
    }
  );

  /**
   * Update RSVP status
   */
  updateRSVP = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const invitation = await invitationService.updateRSVP(id, req.body);

    const response: ApiResponse = {
      success: true,
      message: 'RSVP updated successfully',
      data: { invitation },
    };

    res.status(200).json(response);
  });

  /**
   * Check-in guest using QR code
   */
  checkInGuest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { qrCode } = req.params;
    const invitation = await invitationService.checkInGuest(qrCode);

    const response: ApiResponse = {
      success: true,
      message: 'Guest checked in successfully',
      data: { invitation },
    };

    res.status(200).json(response);
  });

  /**
   * Resend invitation
   */
  resendInvitation = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const { id } = req.params;
      const result = await invitationService.resendInvitation(id, req.user.userId);

      const response: ApiResponse = {
        success: true,
        message: result.message,
      };

      res.status(200).json(response);
    }
  );

  /**
   * Import guests from CSV
   */
  importGuestsFromCSV = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'CSV file is required',
        });
      }

      const { eventId } = req.body as { eventId: string };
      if (!eventId) {
        return res.status(400).json({
          success: false,
          error: 'Event ID is required',
        });
      }

      const result = await invitationService.importGuestsFromCSV(
        eventId,
        req.user.userId,
        req.file.path
      );

      const response: ApiResponse = {
        success: true,
        message: `CSV import completed: ${result.successful.length} successful, ${result.failed.length} failed`,
        data: result,
      };

      res.status(200).json(response);
    }
  );

  /**
   * Export guest list to CSV
   */
  exportGuestListToCSV = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const { eventId } = req.params;
      const fileName = await invitationService.exportGuestListToCSV(eventId, req.user.userId);

      const filePath = path.join(process.cwd(), 'uploads', 'temp', fileName);

      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      // Send file
      res.sendFile(filePath, err => {
        if (err) {
          res.status(500).json({
            success: false,
            error: 'Failed to download file',
          });
        }
      });
    }
  );

  /**
   * Get invitation by QR code (for public RSVP page)
   */
  getInvitationByQR = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { qrCode } = req.params;

    // Get invitation details for RSVP page
    const invitation = await invitationService.getInvitationByQR(qrCode);

    const response: ApiResponse = {
      success: true,
      data: { invitation },
    };

    res.status(200).json(response);
  });

  /**
   * Get invitation statistics for an event
   */
  getInvitationStats = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const { eventId } = req.params;
      const stats = await invitationService.getInvitationStats(eventId, req.user.userId);

      const response: ApiResponse = {
        success: true,
        data: { stats },
      };

      res.status(200).json(response);
    }
  );

  /**
   * Send reminder to pending guests
   */
  sendReminders = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const { eventId } = req.params;
      const result = await invitationService.sendReminders(eventId, req.user.userId);

      const response: ApiResponse = {
        success: true,
        message: `Reminders sent to ${result.sent} guests`,
        data: { sent: result.sent, failed: result.failed },
      };

      res.status(200).json(response);
    }
  );

  /**
   * Delete invitation
   */
  deleteInvitation = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const { id } = req.params;
      const result = await invitationService.deleteInvitation(id, req.user.userId);

      const response: ApiResponse = {
        success: true,
        message: result.message,
      };

      res.status(200).json(response);
    }
  );
  /**
   * Upload invitation card
   */
  uploadCard = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const { id } = req.params;
      const { image } = req.body; // Base64 image

      if (!image) {
        return res.status(400).json({
          success: false,
          error: 'Image data is required',
        });
      }

      console.log(`📸 Received card upload request for invitation ${id} from user ${req.user.userId}`);

      const result = await invitationService.uploadCard(id, req.user.userId, image);

      const response: ApiResponse = {
        success: true,
        message: 'Card uploaded successfully',
        data: { cardUrl: result.cardUrl },
      };

      res.status(200).json(response);
    }
  );

  /**
   * Update card URL (called by worker)
   * POST /api/invitations/:id/card-url
   */
  updateCardUrl = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.params;
      const { cardUrl } = req.body;

      if (!cardUrl) {
        return res.status(400).json({
          success: false,
          error: 'Card URL is required',
        });
      }

      // Update invitation with card URL
      const invitation = await invitationService.updateInvitationCardUrl(id, cardUrl);

      const response: ApiResponse = {
        success: true,
        message: 'Card URL updated successfully',
        data: { invitation },
      };

      res.status(200).json(response);
    }
  );
}

export default new InvitationController();
