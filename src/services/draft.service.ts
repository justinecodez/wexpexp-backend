import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../entities/Event';
import { EventStatus } from '../entities/enums';
import { AppError } from '../utils/errors';
import logger from '../config/logger';

@Injectable()
export class DraftService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>
  ) {}

  /**
   * Save or update a draft
   */
  async saveDraft(userId: string, eventData: Partial<Event>, draftId?: string): Promise<Event> {
    try {
      let draft: Event;

      if (draftId) {
        // Update existing draft
        draft = await this.eventRepository.findOne({
          where: { id: draftId, userId, status: EventStatus.DRAFT }
        });

        if (!draft) {
          throw new AppError('Draft not found', 404);
        }

        draft = {
          ...draft,
          ...eventData,
          lastAutosaveAt: new Date()
        };
      } else {
        // Create new draft
        draft = this.eventRepository.create({
          ...eventData,
          userId,
          status: EventStatus.DRAFT,
          lastAutosaveAt: new Date()
        });
      }

      await this.eventRepository.save(draft);
      logger.info(`Draft saved for user ${userId}, draft ID: ${draft.id}`);
      return draft;
    } catch (error) {
      logger.error('Error saving draft:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to save draft', 500);
    }
  }

  /**
   * Get all drafts for a user
   */
  async getUserDrafts(userId: string): Promise<Event[]> {
    try {
      return await this.eventRepository.find({
        where: {
          userId,
          status: EventStatus.DRAFT
        },
        order: {
          lastAutosaveAt: 'DESC'
        }
      });
    } catch (error) {
      logger.error('Error fetching user drafts:', error);
      throw new AppError('Failed to fetch drafts', 500);
    }
  }

  /**
   * Get a specific draft
   */
  async getDraft(userId: string, draftId: string): Promise<Event> {
    try {
      const draft = await this.eventRepository.findOne({
        where: {
          id: draftId,
          userId,
          status: EventStatus.DRAFT
        }
      });

      if (!draft) {
        throw new AppError('Draft not found', 404);
      }

      return draft;
    } catch (error) {
      logger.error('Error fetching draft:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to fetch draft', 500);
    }
  }

  /**
   * Delete a draft
   */
  async deleteDraft(userId: string, draftId: string): Promise<void> {
    try {
      const result = await this.eventRepository.delete({
        id: draftId,
        userId,
        status: EventStatus.DRAFT
      });

      if (result.affected === 0) {
        throw new AppError('Draft not found', 404);
      }
    } catch (error) {
      logger.error('Error deleting draft:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to delete draft', 500);
    }
  }

  /**
   * Publish a draft as an active event
   */
  async publishDraft(userId: string, draftId: string): Promise<Event> {
    try {
      const draft = await this.eventRepository.findOne({
        where: {
          id: draftId,
          userId,
          status: EventStatus.DRAFT
        }
      });

      if (!draft) {
        throw new AppError('Draft not found', 404);
      }

      // Validate required fields before publishing
      this.validateEventForPublishing(draft);

      draft.status = EventStatus.ACTIVE;
      draft.publishedAt = new Date();

      await this.eventRepository.save(draft);
      logger.info(`Draft ${draftId} published as active event`);
      
      return draft;
    } catch (error) {
      logger.error('Error publishing draft:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to publish draft', 500);
    }
  }

  /**
   * Validate that all required fields are present before publishing
   */
  private validateEventForPublishing(draft: Event): void {
    const requiredFields = [
      'title',
      'eventType',
      'eventDate',
      'startTime',
      'maxGuests'
    ];

    const missingFields = requiredFields.filter(
      field => !draft[field as keyof Event]
    );

    if (missingFields.length > 0) {
      throw new AppError(
        `Missing required fields: ${missingFields.join(', ')}`,
        400
      );
    }
  }
}
