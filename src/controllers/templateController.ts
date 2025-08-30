import { Request, Response, NextFunction } from 'express';
import eventTemplateService from '../services/eventTemplateService';
import { ApiResponse, AuthenticatedRequest } from '../types';
import { catchAsync } from '../middleware/errorHandler';

export class TemplateController {
  /**
   * Create event template
   */
  createTemplate = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { eventId, name } = req.body;
    const template = await eventTemplateService.createTemplate(req.user.userId, eventId, name);

    const response: ApiResponse = {
      success: true,
      message: 'Template created successfully',
      data: { template },
    };

    res.status(201).json(response);
  });

  /**
   * Create event from template
   */
  createEventFromTemplate = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { templateId } = req.params;
    const event = await eventTemplateService.createEventFromTemplate(
      req.user.userId,
      templateId,
      req.body
    );

    const response: ApiResponse = {
      success: true,
      message: 'Event created from template successfully',
      data: { event },
    };

    res.status(201).json(response);
  });

  /**
   * Get user's templates
   */
  getUserTemplates = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const templates = await eventTemplateService.getUserTemplates(req.user.userId);

    const response: ApiResponse = {
      success: true,
      data: { templates },
    };

    res.status(200).json(response);
  });

  /**
   * Update template
   */
  updateTemplate = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { templateId } = req.params;
    const template = await eventTemplateService.updateTemplate(
      req.user.userId,
      templateId,
      req.body
    );

    const response: ApiResponse = {
      success: true,
      message: 'Template updated successfully',
      data: { template },
    };

    res.status(200).json(response);
  });

  /**
   * Delete template
   */
  deleteTemplate = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { templateId } = req.params;
    await eventTemplateService.deleteTemplate(req.user.userId, templateId);

    const response: ApiResponse = {
      success: true,
      message: 'Template deleted successfully',
    };

    res.status(200).json(response);
  });
}

export default new TemplateController();
