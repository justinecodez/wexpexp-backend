import { DataSource } from 'typeorm';
import { database } from '../../config/database';
import { User } from '../../entities/User';
import { Event } from '../../entities/Event';
import { createMockUser } from '../fixtures/user.fixture';
import { createMockEvent } from '../fixtures/event.fixture';
import { generateToken } from '../../utils/auth';

export async function setupTestDatabase() {
  try {
    await database.connect();
  } catch (error) {
    console.error('Error setting up test database:', error);
    throw error;
  }
}

export async function teardownTestDatabase() {
  try {
    // Clean up all test data
    const dataSource = database.getDataSource();
    await dataSource.getRepository(Event).delete({});
    await dataSource.getRepository(User).delete({});
    await database.disconnect();
  } catch (error) {
    console.error('Error tearing down test database:', error);
    throw error;
  }
}

export async function createTestUser(userOverrides?: Partial<User>): Promise<User> {
  const dataSource = database.getDataSource();
  const userRepo = dataSource.getRepository(User);
  const testUser = createMockUser(userOverrides);
  return await userRepo.save(testUser);
}

export async function createTestEvent(eventOverrides?: Partial<Event>): Promise<Event> {
  const dataSource = database.getDataSource();
  const eventRepo = dataSource.getRepository(Event);
  const testEvent = createMockEvent(eventOverrides);
  return await eventRepo.save(testEvent);
}

export function getAuthToken(user: User): string {
  return generateToken(user);
}
