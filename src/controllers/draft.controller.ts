import { Request, Response } from 'express';
import { DraftService } from '../services/draft.service';
import { handleAsync } from '../utils/errorHandler';
import { AuthenticatedRequest } from '../types';

export class DraftController {
  constructor(private readonly draftService: DraftService) {}

  /**
   * Save or update draft
   */
  saveDraft = handleAsync(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { draftId } = req.params;
    const draft = await this.draftService.saveDraft(userId, req.body, draftId);

    res.status(200).json({
      success: true,
      message: 'Draft saved successfully',
      data: { draft },
    });
  });

  /**
   * Get all drafts for the user
   */
  getUserDrafts = handleAsync(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const drafts = await this.draftService.getUserDrafts(userId);

    res.status(200).json({
      success: true,
      data: { drafts },
    });
  });

  /**
   * Get specific draft
   */
  getDraft = handleAsync(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { draftId } = req.params;
    const draft = await this.draftService.getDraft(userId, draftId);

    res.status(200).json({
      success: true,
      data: { draft },
    });
  });

  /**
   * Delete draft
   */
  deleteDraft = handleAsync(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { draftId } = req.params;
    await this.draftService.deleteDraft(userId, draftId);

    res.status(200).json({
      success: true,
      message: 'Draft deleted successfully',
    });
  });

  /**
   * Publish draft as active event
   */
  publishDraft = handleAsync(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { draftId } = req.params;
    const event = await this.draftService.publishDraft(userId, draftId);

    res.status(200).json({
      success: true,
      message: 'Draft published successfully',
      data: { event },
    });
  });
}
