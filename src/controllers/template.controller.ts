import { Request, Response } from 'express';
import { EventTemplateService } from '../services/eventTemplate.service';
import { createTemplateSchema, updateTemplateSchema } from '../utils/validation';
import { errorHandler } from '../middleware/errorHandler';
import { ValidationError } from '../utils/errors';

export class TemplateController {
  constructor(private templateService: EventTemplateService) { }

  createTemplate = errorHandler(async (req: Request, res: Response) => {
    const validatedData = createTemplateSchema.parse(req.body);
    const userId = req.user!.id;

    const template = await this.templateService.createTemplate(userId, validatedData);
    res.status(201).json({
      status: 'success',
      data: template,
    });
  });

  getTemplates = handleAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const templates = await this.templateService.getTemplates(userId);

    res.status(200).json({
      status: 'success',
      data: templates,
    });
  });

  getTemplateById = handleAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const templateId = req.params.id;

    const template = await this.templateService.getTemplateById(userId, templateId);
    if (!template) {
      throw new ValidationError('Template not found');
    }

    res.status(200).json({
      status: 'success',
      data: template,
    });
  });

  updateTemplate = handleAsync(async (req: Request, res: Response) => {
    const validatedData = updateTemplateSchema.parse(req.body);
    const userId = req.user!.id;
    const templateId = req.params.id;

    const template = await this.templateService.updateTemplate(
      userId,
      templateId,
      validatedData
    );

    res.status(200).json({
      status: 'success',
      data: template,
    });
  });

  deleteTemplate = handleAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const templateId = req.params.id;

    await this.templateService.deleteTemplate(userId, templateId);
    res.status(204).send();
  });

  createEventFromTemplate = handleAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const templateId = req.params.id;
    const overrides = req.body;

    const event = await this.templateService.createEventFromTemplate(
      userId,
      templateId,
      overrides
    );

    res.status(201).json({
      status: 'success',
      data: event,
    });
  });
}
