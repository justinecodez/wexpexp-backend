import { AppError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { Event } from '../entities';

export class DraftService {
  constructor() {}

  /**
   * Save event as draft
   * TODO: Implement with TypeORM when needed
   */
  async saveDraft(userId: string, eventData: Partial<Event>, draftId?: string): Promise<Event> {
    throw new AppError('Draft functionality not implemented yet', 501, 'NOT_IMPLEMENTED');
  }

  /**
   * Get all drafts for a user
   * TODO: Implement with TypeORM when needed
   */
  async getUserDrafts(userId: string): Promise<Event[]> {
    throw new AppError('Draft functionality not implemented yet', 501, 'NOT_IMPLEMENTED');
  }

  /**
   * Get a specific draft
   * TODO: Implement with TypeORM when needed
   */
  async getDraft(userId: string, draftId: string): Promise<Event | null> {
    throw new AppError('Draft functionality not implemented yet', 501, 'NOT_IMPLEMENTED');
  }

  /**
   * Delete a draft
   * TODO: Implement with TypeORM when needed
   */
  async deleteDraft(userId: string, draftId: string): Promise<void> {
    throw new AppError('Draft functionality not implemented yet', 501, 'NOT_IMPLEMENTED');
  }

  /**
   * Convert draft to active event
   * TODO: Implement with TypeORM when needed
   */
  async publishDraft(userId: string, draftId: string): Promise<Event> {
    throw new AppError('Draft functionality not implemented yet', 501, 'NOT_IMPLEMENTED');
  }
}
