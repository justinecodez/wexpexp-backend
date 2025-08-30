# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is the **Tanzania Event Planning & Services Platform Backend** - a comprehensive Node.js TypeScript API server built for Tanzania's event planning and services ecosystem. The platform handles digital invitations, multi-service bookings, and real-time event coordination with Tanzania-specific features.

## Common Development Commands

### Database Operations
```powershell
# Generate TypeORM client
npm run db:generate

# Run database migrations
npm run db:migrate

# Revert last migration
npm run db:revert

# Reset database completely
npm run db:reset

# Seed database with sample data
npm run db:seed
```

### Development & Build
```powershell
# Start development server with hot reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Start production server
npm start

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration
```

### Code Quality
```powershell
# Lint TypeScript code
npm run lint

# Fix linting issues automatically  
npm run lint:fix

# Format code with Prettier
npm run format
```

### Docker Operations
```powershell
# Start all services (PostgreSQL, Redis, API, Nginx)
docker-compose up -d

# Build and run single container
docker build -t tanzania-events-api .
docker run -p 3000:3000 --env-file .env tanzania-events-api

# View logs
docker-compose logs -f api
```

### Test Single Components
```powershell
# Test specific service
npm test -- --testNamePattern="EventService"

# Test specific controller
npm test -- src/controllers/eventController.test.ts

# Run integration tests for specific endpoint
npm run test:integration -- --testNamePattern="auth"
```

## Architecture Overview

### Tech Stack
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with decorators and dependency injection patterns
- **Database**: SQLite (development) with TypeORM for production-ready PostgreSQL support
- **Real-time**: Socket.IO for live updates and notifications
- **Authentication**: JWT with refresh tokens
- **Validation**: Zod schemas for request/response validation
- **File Handling**: Multer with configurable storage backends

### Project Structure
```
src/
├── entities/          # TypeORM database entities (User, Event, Booking, etc.)
├── controllers/       # Express route handlers
├── services/          # Business logic layer
├── routes/           # Express route definitions
├── middleware/       # Custom middleware (auth, validation, rate limiting)
├── config/           # Configuration files (database, logger, etc.)
├── types/            # TypeScript type definitions
├── utils/            # Helper functions and utilities
├── context/          # Context objects for services
├── validation/       # Zod validation schemas
└── migrations/       # TypeORM database migrations
```

### Key Architectural Patterns

**Entity-Service-Controller Pattern**: Each major feature (Events, Users, Tours, Vehicles) follows a consistent pattern:
- `Entity` (TypeORM): Database schema with relationships
- `Service`: Business logic and database operations  
- `Controller`: HTTP request handling and response formatting
- `Routes`: Express route configuration
- `Validation`: Zod schema validation

**Context-Based Services**: Services use context objects to manage dependencies and provide clean interfaces for database operations.

**Tanzania-Specific Features**: The platform includes Tanzania-focused functionality:
- Phone number validation for Tanzanian operators (+255 format)
- TZS currency handling and formatting
- Major Tanzania cities enum (Dar es Salaam, Arusha, Zanzibar, etc.)
- Integration with local SMS providers (Beem, TTCL)
- Mobile money payment gateways (M-Pesa, Tigo Pesa, Airtel Money)

### Database Architecture

**Core Entities**:
- `User`: Authentication and profile management
- `Event`: Event planning with RSVP tracking
- `Invitation`: Multi-channel invitation delivery (Email/SMS/WhatsApp)
- `Booking`: Multi-service booking system
- `Service Entities`: Tour, Vehicle, Accommodation, Venue, Decoration

**Key Relationships**:
- User → Events (1:Many)
- Event → Invitations (1:Many)  
- User → Bookings (1:Many)
- Services → Bookings (1:Many through service_id + service_type)

### Authentication Flow

The platform uses JWT with refresh tokens:
1. Login returns `accessToken` (1h expiry) + `refreshToken` (7d expiry)
2. Protected routes require `Authorization: Bearer <accessToken>`
3. Token refresh via `/api/auth/refresh` endpoint
4. User roles: ADMIN, USER, VENDOR

### Real-time Features

Socket.IO implementation provides:
- Real-time RSVP updates for event organizers
- Guest check-in notifications
- Booking status updates
- Event room management
- Chat functionality for event coordination

## Environment Configuration

The platform uses extensive environment configuration. Key categories:

**Database**: SQLite for development, PostgreSQL for production
**Communication**: SMTP, SMS (Beem/TTCL), WhatsApp Business API
**Payment**: Tanzania mobile money integration placeholders
**Cloud Storage**: AWS S3 and Cloudinary support
**Security**: JWT secrets, CORS origins, rate limiting

Copy `env.example` to `.env` and configure for your environment.

## Testing Strategy

**Unit Tests**: Individual service and utility function testing
**Integration Tests**: Full API endpoint testing with test database
**Fixtures**: Reusable test data for consistent testing

Test files follow naming convention: `*.test.ts` for unit tests, `*.integration.test.ts` for integration tests.

## Development Guidelines

### Database Changes
- Always create migrations for schema changes: `npm run db:generate src/migrations/DescriptiveName`
- Test migrations on fresh database before committing
- Use TypeORM repository pattern, avoid raw queries

### API Development  
- Follow REST conventions with proper HTTP status codes
- Use Zod validation schemas for all request bodies
- Implement proper error handling with `AppError` class
- Add rate limiting for sensitive endpoints

### Tanzania-Specific Development
- Use TanzaniaCity enum for location fields
- Validate phone numbers with Tanzania format (+255XXXXXXXXX)
- Handle TZS currency with proper precision (no decimals)
- Consider EAT timezone (UTC+3) for date/time operations

### File Organization
- Group related functionality by feature (events/, tours/, etc.)
- Keep entities, services, controllers, and routes together
- Use barrel exports (`index.ts`) for clean imports
- Follow TypeScript path aliases defined in `tsconfig.json`

## Health Monitoring

The application includes comprehensive health checks:
- `/health` - Overall system health (database + email)
- `/health/email` - Email service connectivity
- Database connection monitoring
- Service dependency validation

## Security Considerations

- Helmet.js for security headers
- CORS configuration for cross-origin requests  
- Rate limiting on authentication and communication endpoints
- Input validation with Zod schemas
- Password hashing with bcrypt
- JWT token security with proper expiration
- File upload security and size limits

## Performance Optimizations

- Database query optimization with proper indexing
- Pagination for all list endpoints (max 100 items per page)
- Image/file upload size restrictions
- Connection pooling for database operations
- Caching strategy with Redis (in Docker setup)

## API Documentation

The platform provides self-documenting API at `/api` endpoint with:
- All available endpoints
- Authentication requirements
- Tanzania-specific features
- Real-time Socket.IO events
- Error response formats

## Deployment Notes

**Docker**: Multi-container setup with PostgreSQL, Redis, API server, and Nginx
**Database**: Automatic migrations on startup
**File Storage**: Persistent volumes for uploads and logs
**Health Checks**: Built-in Docker health monitoring
**Environment**: Production-ready configuration options

The platform is designed for Tanzania's event planning market with comprehensive service integration and real-time event management capabilities.
