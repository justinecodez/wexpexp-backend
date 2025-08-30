import { config } from '../config';

// Set environment to test
process.env.NODE_ENV = 'test';

// Configure test timeouts
jest.setTimeout(30000);

// Silence console logs during tests unless explicitly enabled
if (!config.debug) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}
