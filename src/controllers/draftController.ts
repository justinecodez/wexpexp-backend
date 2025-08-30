import { Response } from 'express';
import { DraftService } from '../services/draftService';
import { catchAsync } from '../middleware/errorHandler';
import { AuthenticatedRequest, ApiResponse } from '../types';
import database from '../config/database';

class DraftController {
  private draftService: DraftService;

  constructor() {
    this.draftService = new DraftService();
  }

  /**
   * Save or update draft
   */
  saveDraft = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { draftId } = req.params;
    const draft = await this.draftService.saveDraft(
      req.user.userId,
      req.body,
      draftId
    );

    const response: ApiResponse = {
      success: true,
      message: 'Draft saved successfully',
      data: { draft },
    };

    res.status(200).json(response);
  });

  /**
   * Get all drafts for the user
   */
  getUserDrafts = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const drafts = await this.draftService.getUserDrafts(req.user.userId);

    const response: ApiResponse = {
      success: true,
      data: { drafts },
    };

    res.status(200).json(response);
  });

  /**
   * Get specific draft
   */
  getDraft = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { draftId } = req.params;
    const draft = await this.draftService.getDraft(req.user.userId, draftId);

    if (!draft) {
      return res.status(404).json({
        success: false,
        error: 'Draft not found',
      });
    }

    const response: ApiResponse = {
      success: true,
      data: { draft },
    };

    res.status(200).json(response);
  });

  /**
   * Delete draft
   */
  deleteDraft = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { draftId } = req.params;
    await this.draftService.deleteDraft(req.user.userId, draftId);

    const response: ApiResponse = {
      success: true,
      message: 'Draft deleted successfully',
    };

    res.status(200).json(response);
  });

  /**
   * Publish draft as active event
   */
  publishDraft = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { draftId } = req.params;
    const event = await this.draftService.publishDraft(req.user.userId, draftId);

    const response: ApiResponse = {
      success: true,
      message: 'Draft published successfully',
      data: { event },
    };

    res.status(200).json(response);
  });
}

export default new DraftController();
