import { Router } from 'express';
import { TemplateController } from '../controllers/template.controller';
import { authenticateUser } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { createTemplateSchema, updateTemplateSchema, idParamSchema } from '../utils/validation';

export const createTemplateRouter = (templateController: TemplateController): Router => {
  const router = Router();

  // Apply authentication middleware to all routes
  router.use(authenticateUser);

  // GET /templates - Get all templates for the user
  router.get('/', templateController.getTemplates);

  // POST /templates - Create a new template
  router.post(
    '/',
    validateRequest({ body: createTemplateSchema }),
    templateController.createTemplate
  );

  // GET /templates/:id - Get a specific template
  router.get(
    '/:id',
    validateRequest({ params: idParamSchema }),
    templateController.getTemplateById
  );

  // PUT /templates/:id - Update a template
  router.put(
    '/:id',
    validateRequest({ params: idParamSchema, body: updateTemplateSchema }),
    templateController.updateTemplate
  );

  // DELETE /templates/:id - Delete a template
  router.delete(
    '/:id',
    validateRequest({ params: idParamSchema }),
    templateController.deleteTemplate
  );

  // POST /templates/:id/create-event - Create an event from a template
  router.post(
    '/:id/create-event',
    validateRequest({ params: idParamSchema }),
    templateController.createEventFromTemplate
  );

  return router;
};
