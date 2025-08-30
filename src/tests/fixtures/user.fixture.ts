import { User } from '../../entities/User';

export const createMockUser = (overrides?: Partial<User>): User => ({
  id: 'test-user-id',
  email: 'test@example.com',
  password: 'hashedPassword123',
  firstName: 'Test',
  lastName: 'User',
  phone: '+255123456789',
  companyName: 'Test Company',
  businessType: 'INDIVIDUAL',
  isVerified: true,
  isActive: true,
  resetPasswordToken: null,
  resetPasswordExpiry: null,
  verificationToken: null,
  verificationExpiry: null,
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  events: [],
  invitations: [],
  ...overrides
});
