import { Repository } from 'typeorm';
import { Event } from '../../entities/Event';
import { DraftService } from '../../services/draft.service';
import { EventStatus } from '../../entities/enums';
import { AppError } from '../../utils/errors';
import { createMockEvent } from '../fixtures/event.fixture';
import { createMockUser } from '../fixtures/user.fixture';

describe('DraftService', () => {
  let draftService: DraftService;
  let mockEventRepository: Repository<Event>;
  const mockUser = createMockUser();
  const mockEvent = createMockEvent({ userId: mockUser.id });

  beforeEach(() => {
    mockEventRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    } as unknown as Repository<Event>;

    draftService = new DraftService(mockEventRepository);
  });

  describe('saveDraft', () => {
    it('should create a new draft successfully', async () => {
      const draftData = {
        title: 'New Event Draft',
        eventType: 'WEDDING',
        status: EventStatus.DRAFT,
      };

      mockEventRepository.create.mockReturnValue({ ...mockEvent, ...draftData });
      mockEventRepository.save.mockResolvedValue({ ...mockEvent, ...draftData });

      const result = await draftService.saveDraft(mockUser.id, draftData);

      expect(result).toMatchObject(draftData);
      expect(result.userId).toBe(mockUser.id);
      expect(result.status).toBe(EventStatus.DRAFT);
      expect(result.lastAutosaveAt).toBeDefined();
    });

    it('should update an existing draft successfully', async () => {
      const existingDraft = { ...mockEvent, status: EventStatus.DRAFT };
      const updateData = { title: 'Updated Draft Title' };

      mockEventRepository.findOne.mockResolvedValue(existingDraft);
      mockEventRepository.save.mockResolvedValue({ ...existingDraft, ...updateData });

      const result = await draftService.saveDraft(mockUser.id, updateData, existingDraft.id);

      expect(result.title).toBe(updateData.title);
      expect(result.lastAutosaveAt).toBeDefined();
    });

    it('should throw error when updating non-existent draft', async () => {
      mockEventRepository.findOne.mockResolvedValue(null);

      await expect(
        draftService.saveDraft(mockUser.id, { title: 'Update' }, 'non-existent-id')
      ).rejects.toThrow(AppError);
    });
  });

  describe('getUserDrafts', () => {
    it('should return all drafts for a user', async () => {
      const mockDrafts = [
        { ...mockEvent, status: EventStatus.DRAFT },
        { ...mockEvent, id: 'draft-2', status: EventStatus.DRAFT },
      ];

      mockEventRepository.find.mockResolvedValue(mockDrafts);

      const result = await draftService.getUserDrafts(mockUser.id);

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe(EventStatus.DRAFT);
      expect(mockEventRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUser.id, status: EventStatus.DRAFT },
        order: { lastAutosaveAt: 'DESC' },
      });
    });
  });

  describe('publishDraft', () => {
    it('should publish draft successfully', async () => {
      const draft = { ...mockEvent, status: EventStatus.DRAFT };
      const publishedEvent = { ...draft, status: EventStatus.ACTIVE };

      mockEventRepository.findOne.mockResolvedValue(draft);
      mockEventRepository.save.mockResolvedValue(publishedEvent);

      const result = await draftService.publishDraft(mockUser.id, draft.id);

      expect(result.status).toBe(EventStatus.ACTIVE);
      expect(result.publishedAt).toBeDefined();
    });

    it('should throw error when publishing non-existent draft', async () => {
      mockEventRepository.findOne.mockResolvedValue(null);

      await expect(
        draftService.publishDraft(mockUser.id, 'non-existent-id')
      ).rejects.toThrow(AppError);
    });

    it('should validate required fields before publishing', async () => {
      const incompleteDraft = {
        ...mockEvent,
        status: EventStatus.DRAFT,
        title: undefined,
      };

      mockEventRepository.findOne.mockResolvedValue(incompleteDraft);

      await expect(
        draftService.publishDraft(mockUser.id, incompleteDraft.id)
      ).rejects.toThrow(/Missing required fields/);
    });
  });

  describe('deleteDraft', () => {
    it('should delete draft successfully', async () => {
      mockEventRepository.delete.mockResolvedValue({ affected: 1 });

      await expect(
        draftService.deleteDraft(mockUser.id, mockEvent.id)
      ).resolves.not.toThrow();
    });

    it('should throw error when deleting non-existent draft', async () => {
      mockEventRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(
        draftService.deleteDraft(mockUser.id, 'non-existent-id')
      ).rejects.toThrow(AppError);
    });
  });
});
