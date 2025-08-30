import request from 'supertest';
import App from '../../app';
import { User } from '../../entities/User';
import { Event } from '../../entities/Event';
import { EventStatus, EventType } from '../../entities/enums';
import {
  setupTestDatabase,
  teardownTestDatabase,
  createTestUser,
  createTestEvent,
  getAuthToken,
} from '../helpers/setup';

describe('Draft API Integration Tests', () => {
  let app: App;
  let testUser: User;
  let authToken: string;
  let testEvent: Event;

  beforeAll(async () => {
    await setupTestDatabase();
    app = new App();
    await app.start();
  });

  beforeEach(async () => {
    testUser = await createTestUser();
    authToken = getAuthToken(testUser);
    testEvent = await createTestEvent({
      userId: testUser.id,
      status: EventStatus.DRAFT,
    });
  });

  afterEach(async () => {
    const dataSource = app['database'].getDataSource();
    await dataSource.getRepository(Event).delete({});
    await dataSource.getRepository(User).delete({});
  });

  afterAll(async () => {
    await teardownTestDatabase();
    await app.shutdown();
  });

  describe('GET /api/drafts', () => {
    it('should return all drafts for authenticated user', async () => {
      // Create multiple drafts
      await createTestEvent({
        userId: testUser.id,
        status: EventStatus.DRAFT,
        title: 'Draft 2',
      });
      await createTestEvent({
        userId: testUser.id,
        status: EventStatus.DRAFT,
        title: 'Draft 3',
      });

      const response = await request(app.app)
        .get('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.drafts).toHaveLength(3);
      expect(response.body.data.drafts[0].status).toBe(EventStatus.DRAFT);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app.app).get('/api/drafts');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/drafts/:id', () => {
    it('should return specific draft for authenticated user', async () => {
      const response = await request(app.app)
        .get(`/api/drafts/${testEvent.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.draft.id).toBe(testEvent.id);
    });

    it('should return 404 for non-existent draft', async () => {
      const response = await request(app.app)
        .get('/api/drafts/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/drafts', () => {
    it('should create new draft successfully', async () => {
      const draftData = {
        title: 'New Test Event',
        eventType: EventType.WEDDING,
        eventDate: '2025-12-31',
        startTime: '14:00',
        maxGuests: 100,
      };

      const response = await request(app.app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(draftData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.draft.title).toBe(draftData.title);
      expect(response.body.data.draft.status).toBe(EventStatus.DRAFT);
      expect(response.body.data.draft.lastAutosaveAt).toBeDefined();
    });

    it('should handle validation errors', async () => {
      const invalidData = {
        title: '', // Invalid: empty title
        eventType: 'INVALID_TYPE', // Invalid event type
      };

      const response = await request(app.app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });
  });

  describe('PUT /api/drafts/:id', () => {
    it('should update draft successfully', async () => {
      const updateData = {
        title: 'Updated Draft Title',
        description: 'Updated description',
      };

      const response = await request(app.app)
        .put(`/api/drafts/${testEvent.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.draft.title).toBe(updateData.title);
      expect(response.body.data.draft.lastAutosaveAt).toBeDefined();
    });

    it('should handle partial updates', async () => {
      const updateData = {
        title: 'Updated Title Only',
      };

      const response = await request(app.app)
        .put(`/api/drafts/${testEvent.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.data.draft.title).toBe(updateData.title);
      expect(response.body.data.draft.description).toBe(testEvent.description);
    });
  });

  describe('DELETE /api/drafts/:id', () => {
    it('should delete draft successfully', async () => {
      const response = await request(app.app)
        .delete(`/api/drafts/${testEvent.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify draft is deleted
      const getResponse = await request(app.app)
        .get(`/api/drafts/${testEvent.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent draft', async () => {
      const response = await request(app.app)
        .delete('/api/drafts/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/drafts/:id/publish', () => {
    it('should publish draft successfully', async () => {
      // Create a complete draft
      const completeDraft = await createTestEvent({
        userId: testUser.id,
        status: EventStatus.DRAFT,
        title: 'Complete Draft',
        eventType: EventType.WEDDING,
        eventDate: new Date('2025-12-31'),
        startTime: '14:00',
        maxGuests: 100,
      });

      const response = await request(app.app)
        .post(`/api/drafts/${completeDraft.id}/publish`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.event.status).toBe(EventStatus.ACTIVE);
      expect(response.body.data.event.publishedAt).toBeDefined();
    });

    it('should validate required fields before publishing', async () => {
      // Create an incomplete draft
      const incompleteDraft = await createTestEvent({
        userId: testUser.id,
        status: EventStatus.DRAFT,
        title: 'Incomplete Draft',
        // Missing required fields
      });

      const response = await request(app.app)
        .post(`/api/drafts/${incompleteDraft.id}/publish`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });
  });

  describe('Auto-save functionality', () => {
    it('should update lastAutosaveAt timestamp on each update', async () => {
      const firstUpdate = {
        title: 'First Update',
      };

      const firstResponse = await request(app.app)
        .put(`/api/drafts/${testEvent.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(firstUpdate);

      const firstAutoSave = new Date(firstResponse.body.data.draft.lastAutosaveAt);

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1000));

      const secondUpdate = {
        description: 'Second Update',
      };

      const secondResponse = await request(app.app)
        .put(`/api/drafts/${testEvent.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(secondUpdate);

      const secondAutoSave = new Date(secondResponse.body.data.draft.lastAutosaveAt);

      expect(secondAutoSave.getTime()).toBeGreaterThan(firstAutoSave.getTime());
    });
  });
});
