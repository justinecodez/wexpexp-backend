import database from '../config/database';
import { Event, EventDraft } from '../entities';
import { Repository } from 'typeorm';
import { AppError } from '../middleware/errorHandler';
import { CreateEventRequest } from '../types';
import logger from '../config/logger';

export class EventDraftService {
  private draftRepository: Repository<EventDraft>;
  private eventRepository: Repository<Event>;

  constructor() {
    this.draftRepository = database.getRepository(EventDraft);
    this.eventRepository = database.getRepository(Event);
  }

  /**
   * Auto-save event draft
   */
  async autoSaveDraft(userId: string, eventId: string | null, data: Partial<CreateEventRequest>): Promise<EventDraft> {
    let existingDraft: EventDraft | null = null;

    if (eventId) {
      // Check if draft exists for this event
      existingDraft = await this.draftRepository.findOne({
        where: { userId, eventId },
      });
    }

    if (!existingDraft) {
      // Create new draft
      existingDraft = this.draftRepository.create({
        userId,
        eventId,
        data: data as any,
        lastSaved: new Date(),
      });
    } else {
      // Update existing draft
      Object.assign(existingDraft, {
        data: { ...existingDraft.data, ...data },
        lastSaved: new Date(),
      });
    }

    const savedDraft = await this.draftRepository.save(existingDraft);
    logger.info(`Draft auto-saved: ${savedDraft.id} for event: ${eventId || 'new'}`);

    return savedDraft;
  }

  /**
   * Get user's event drafts
   */
  async getUserDrafts(userId: string): Promise<EventDraft[]> {
    return this.draftRepository.find({
      where: { userId },
      order: { lastSaved: 'DESC' },
    });
  }

  /**
   * Get a specific draft
   */
  async getDraft(userId: string, draftId: string): Promise<EventDraft> {
    const draft = await this.draftRepository.findOne({
      where: { id: draftId, userId },
    });

    if (!draft) {
      throw new AppError('Draft not found', 404, 'DRAFT_NOT_FOUND');
    }

    return draft;
  }

  /**
   * Create event from draft
   */
  async createEventFromDraft(userId: string, draftId: string): Promise<Event> {
    const draft = await this.getDraft(userId, draftId);

    // Create event from draft data
    const event = this.eventRepository.create({
      userId,
      ...draft.data,
      status: 'DRAFT',
    });

    const savedEvent = await this.eventRepository.save(event);
    
    // Delete the draft after successful event creation
    await this.deleteDraft(userId, draftId);

    logger.info(`Event created from draft: ${draftId} -> ${savedEvent.id}`);
    return savedEvent;
  }

  /**
   * Update existing event from draft
   */
  async updateEventFromDraft(userId: string, eventId: string, draftId: string): Promise<Event> {
    const [draft, event] = await Promise.all([
      this.getDraft(userId, draftId),
      this.eventRepository.findOne({ where: { id: eventId, userId } }),
    ]);

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    // Update event with draft data
    Object.assign(event, draft.data);
    const updatedEvent = await this.eventRepository.save(event);

    // Delete the draft after successful update
    await this.deleteDraft(userId, draftId);

    logger.info(`Event updated from draft: ${draftId} -> ${eventId}`);
    return updatedEvent;
  }

  /**
   * Delete a draft
   */
  async deleteDraft(userId: string, draftId: string): Promise<void> {
    const draft = await this.getDraft(userId, draftId);
    await this.draftRepository.remove(draft);
    logger.info(`Draft deleted: ${draftId}`);
  }

  /**
   * Clean up old drafts
   */
  async cleanupOldDrafts(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.draftRepository.delete({
      lastSaved: { $lt: cutoffDate } as any,
    });

    logger.info(`Cleaned up ${result.affected || 0} old drafts`);
    return result.affected || 0;
  }
}

export default new EventDraftService();
