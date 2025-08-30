import { Event } from '../../entities/Event';
import { EventType, EventStatus, TanzaniaCity } from '../../entities/enums';

export const createMockEvent = (overrides?: Partial<Event>): Event => ({
  id: 'test-event-id',
  userId: 'test-user-id',
  title: 'Test Event',
  description: 'Test event description',
  eventType: EventType.OTHER,
  eventDate: new Date('2025-12-31'),
  startTime: '14:00',
  endTime: '18:00',
  timezone: 'Africa/Dar_es_Salaam',
  venueName: 'Test Venue',
  venueAddress: '123 Test Street',
  venueCity: TanzaniaCity.DAR_ES_SALAAM,
  maxGuests: 100,
  currentRsvpCount: 0,
  budget: 1000,
  currency: 'TZS',
  status: EventStatus.DRAFT,
  isPublic: false,
  lastAutosaveAt: new Date(),
  publishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: null,
  invitations: [],
  eCards: [],
  ...overrides
});
