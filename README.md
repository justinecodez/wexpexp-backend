# Tanzania Event Planning & Services Platform - Backend

A comprehensive Node.js Express backend for Tanzania's premier event planning and services platform. This platform provides digital invitation management, multi-service booking, and real-time event coordination specifically designed for the Tanzanian market.

## 🌟 Features

### Core Services
- **Event Planning & Digital Invitations** - E-card customization, multi-channel delivery (WhatsApp, SMS, Email), RSVP tracking, QR code check-in
- **Tours & Safari Agency** - Safari packages, cultural tours, adventure activities
- **Car Hiring** - Vehicle rental with drivers, self-drive options
- **Accommodation Management** - Hotel/lodge bookings, vacation rentals
- **Decoration Services** - Event decoration, floral arrangements
- **Venue Selection** - Event venue booking and management
- **Car Importation** - Vehicle import services and consultation
- **Event Insurance** - Coverage for events and activities
- **Budgeting Services** - Event budget planning and management

### Key Features
- Multi-channel invitation delivery (WhatsApp Business API, SMS, Email)
- Real-time RSVP tracking and analytics
- QR code generation and guest check-in system
- Event analytics and reporting
- CSV import/export functionality
- Automated reminder system
- Landing page content management
- File upload and management
- Real-time notifications with Socket.IO

### Tanzania-Specific Features
- Tanzanian phone number validation (+255 format)
- Currency handling (Tanzanian Shilling - TZS)
- Major cities support (Dar es Salaam, Arusha, Zanzibar, etc.)
- Swahili language support for templates
- Local business hours and timezone (EAT - UTC+3)
- Integration-ready for Tanzania SMS providers (Beem, TTCL)
- Mobile money payment gateway support (M-Pesa, Tigo Pesa, Airtel Money)

## 🛠 Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js with TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** JWT with refresh tokens
- **Real-time:** Socket.IO for live updates
- **File Storage:** Multer (configurable for cloud)
- **Email:** Nodemailer with multiple provider support
- **Validation:** Zod for request validation
- **Security:** Helmet, CORS, rate limiting
- **Logging:** Winston with structured logging

## 🚀 Quick Start

### Prerequisites
- Node.js 18 or higher
- PostgreSQL 12 or higher
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run database migrations
   npm run db:migrate
   
   # Seed the database with sample data
   npm run db:seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000`

### Environment Variables

Copy `env.example` to `.env` and configure the following:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/tanzania_event_platform"

# JWT Secrets
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-here"

# Email Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# SMS Configuration (Tanzania)
SMS_PROVIDER="beem"
BEEM_API_KEY="your-beem-api-key"
BEEM_SECRET_KEY="your-beem-secret-key"

# WhatsApp Business API
WHATSAPP_TOKEN="your-whatsapp-business-token"
WHATSAPP_PHONE_ID="your-phone-number-id"

# Additional configuration options available in env.example
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── controllers/          # Route handlers
│   ├── middleware/          # Custom middleware
│   ├── models/             # Prisma schema and types
│   ├── routes/             # Express routes
│   ├── services/           # Business logic
│   ├── utils/              # Helper functions
│   ├── types/              # TypeScript types
│   ├── config/             # Configuration files
│   └── app.ts              # Express app setup
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── migrations/         # Database migrations
│   └── seed.ts             # Database seeding
├── uploads/                # File storage directory
├── tests/                  # Test files
├── server.ts               # Server entry point
└── package.json
```

---

# 📚 API Documentation

## Base URL

```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

## Authentication

All protected endpoints require JWT authentication via the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+255754123456",
  "companyName": "Optional Company",
  "businessType": "INDIVIDUAL"
}
```

#### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "...", "firstName": "..." },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

#### Refresh Token
```http
POST /api/auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Additional Auth Endpoints
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/forgot-password` - Request password reset
- `PUT /api/auth/reset-password` - Reset password with token
- `POST /api/auth/verify-email` - Email verification
- `PUT /api/auth/change-password` - Change password (authenticated user)

## Events Management

### Create Event
```http
POST /api/events
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "Wedding Celebration",
  "description": "A beautiful wedding ceremony",
  "eventType": "WEDDING",
  "eventDate": "2024-06-15",
  "startTime": "14:00",
  "endTime": "22:00",
  "venueName": "Kilimanjaro Hotel",
  "venueAddress": "Dar es Salaam",
  "venueCity": "DAR_ES_SALAAM",
  "maxGuests": 100,
  "budget": 5000000,
  "isPublic": false
}
```

### Get User Events
```http
GET /api/events?page=1&limit=10&status=ACTIVE&search=wedding
Authorization: Bearer <token>
```

### Additional Event Endpoints
- `GET /api/events/public` - Get public events
- `GET /api/events/stats` - Get event statistics for dashboard
- `GET /api/events/:id` - Get event details
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event
- `POST /api/events/:id/duplicate` - Duplicate event
- `GET /api/events/:id/analytics` - Event analytics and reports
- `PATCH /api/events/:id/status` - Update event status

## Invitations Management

### Create Invitation
```http
POST /api/invitations
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "eventId": "event_id_here",
  "guestName": "Jane Smith",
  "guestEmail": "jane@example.com",
  "guestPhone": "+255765123456",
  "invitationMethod": "EMAIL",
  "specialRequirements": "Vegetarian meal"
}
```

### Bulk Create Invitations
```http
POST /api/invitations/bulk
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "eventId": "event_id_here",
  "invitations": [
    {
      "guestName": "Guest 1",
      "guestEmail": "guest1@example.com",
      "invitationMethod": "EMAIL"
    },
    {
      "guestName": "Guest 2",
      "guestPhone": "+255754999888",
      "invitationMethod": "SMS"
    }
  ]
}
```

### Get Event Invitations
```http
GET /api/invitations/event/:eventId?page=1&limit=10&rsvpStatus=PENDING
Authorization: Bearer <token>
```

### Update RSVP (Public)
```http
PUT /api/invitations/:id/rsvp
```

**Request Body:**
```json
{
  "rsvpStatus": "ACCEPTED",
  "plusOneCount": 1,
  "specialRequirements": "Wheelchair access needed"
}
```

### QR Code Features
```http
GET /api/invitations/qr/:qrCode
POST /api/invitations/qr/:qrCode/checkin
```

### Additional Invitation Endpoints
- `POST /api/invitations/:id/resend` - Resend invitation
- `DELETE /api/invitations/:id` - Delete invitation
- `POST /api/invitations/import-csv` - Import guests from CSV
- `GET /api/invitations/export-csv/:eventId` - Export guest list
- `GET /api/invitations/stats/:eventId` - Get invitation statistics
- `POST /api/invitations/reminders/:eventId` - Send reminders to pending guests

## Tours & Safari

### Get All Tours
```http
GET /api/tours?page=1&limit=10&location=ARUSHA&category=SAFARI&minPrice=100000&maxPrice=2000000
```

### Get Tour by ID
```http
GET /api/tours/:id
```

### Book Tour
```http
POST /api/tours/book
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "serviceType": "TOUR",
  "serviceId": "tour_id_here",
  "bookingDate": "2024-07-01",
  "startDate": "2024-07-01",
  "guests": 4,
  "specialRequests": "Guide who speaks Swahili"
}
```

### Additional Tour Endpoints
- `GET /api/tours/popular?limit=5` - Get popular tours
- `GET /api/tours/category/SAFARI?limit=10` - Get tours by category
- `GET /api/tours/bookings` - Get user tour bookings
- `PUT /api/tours/bookings/:id` - Update tour booking
- `DELETE /api/tours/bookings/:id` - Cancel tour booking

## Vehicle Rental

### Get All Vehicles
```http
GET /api/vehicles?page=1&limit=10&location=DAR_ES_SALAAM&vehicleType=SUV&withDriver=true
```

### Get Vehicle by ID
```http
GET /api/vehicles/:id
```

### Check Vehicle Availability
```http
POST /api/vehicles/:id/check-availability
```

**Request Body:**
```json
{
  "startDate": "2024-06-01",
  "endDate": "2024-06-05"
}
```

### Book Vehicle
```http
POST /api/vehicles/book
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "serviceType": "VEHICLE",
  "serviceId": "vehicle_id_here",
  "bookingDate": "2024-06-01",
  "startDate": "2024-06-01",
  "endDate": "2024-06-05",
  "specialRequests": "Need child car seats"
}
```

### Additional Vehicle Endpoints
- `GET /api/vehicles/types` - Get vehicle types with counts
- `GET /api/vehicles/location/:location` - Get vehicles by location
- `GET /api/vehicles/bookings` - Get user vehicle bookings
- `PUT /api/vehicles/bookings/:id` - Update vehicle booking
- `DELETE /api/vehicles/bookings/:id` - Cancel vehicle booking

## Error Responses

All API endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message here",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Request validation failed
- `AUTHENTICATION_REQUIRED` - User not authenticated
- `ACCESS_DENIED` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `DUPLICATE_ENTRY` - Resource already exists
- `RATE_LIMIT_EXCEEDED` - Too many requests

## Real-time Features (Socket.IO)

### Connection

Connect to Socket.IO with authentication:

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your_jwt_token_here'
  }
});
```

### Event Handlers

#### Join Event Room
```javascript
socket.emit('join-event', 'event_id_here');
```

#### Listen for RSVP Updates
```javascript
socket.on('rsvp-updated', (data) => {
  console.log('New RSVP:', data);
});
```

#### Listen for Guest Check-ins
```javascript
socket.on('guest-checked-in', (data) => {
  console.log('Guest checked in:', data);
});
```

#### Chat Features
```javascript
// Join chat room
socket.emit('join-chat', 'room_id');

// Send message
socket.emit('send-message', {
  roomId: 'room_id',
  message: 'Hello everyone!'
});

// Listen for messages
socket.on('message-received', (message) => {
  console.log('New message:', message);
});
```

#### Booking Updates
```javascript
// Join booking room
socket.emit('join-booking', 'booking_id');

// Listen for booking updates
socket.on('booking-updated', (data) => {
  console.log('Booking status changed:', data);
});
```

## Tanzania-Specific Features

### Phone Number Format
All phone numbers should be in Tanzania format: `+255XXXXXXXXX`

Supported operators:
- **Vodacom**: +255 74X, +255 75X, +255 76X
- **Airtel**: +255 67X, +255 68X, +255 69X, +255 78X
- **Tigo**: +255 65X, +255 71X, +255 77X
- **Halotel**: +255 62X
- **TTCL**: +255 73X

### Currency
All prices are in Tanzanian Shillings (TZS). Example: `1500000` = TZS 1,500,000

### Supported Cities
- `DAR_ES_SALAAM` - Dar es Salaam
- `ARUSHA` - Arusha
- `ZANZIBAR` - Zanzibar
- `MWANZA` - Mwanza
- `DODOMA` - Dodoma
- `TANGA` - Tanga
- `MOROGORO` - Morogoro
- `MBEYA` - Mbeya
- `IRINGA` - Iringa
- `KILIMANJARO` - Kilimanjaro

### Phone Number Validation
```typescript
import { validateTanzanianPhone } from './utils/tanzania';

const phone = validateTanzanianPhone('+255754123456');
// Returns: { isValid: true, formatted: '+255754123456', operator: 'Vodacom' }
```

### Currency Formatting
```typescript
import { formatTanzanianCurrency } from './utils/tanzania';

const price = formatTanzanianCurrency(1500000);
// Returns: "TZS 1,500,000"
```

### SMS Integration
The platform includes mock implementations for:
- **Beem SMS** - Popular SMS gateway in Tanzania
- **TTCL SMS** - Tanzania Telecommunications Company Limited

## Rate Limits

- **Authentication endpoints**: 5 requests per 15 minutes
- **Email/SMS sending**: 10 requests per minute
- **General API**: 100 requests per 15 minutes
- **File uploads**: 20 requests per 15 minutes

## File Uploads

### Supported File Types

#### Images
- JPEG, PNG, GIF, WebP
- Maximum size: 10MB per file

#### Documents
- PDF, DOC, DOCX, XLS, XLSX
- Maximum size: 20MB per file

#### CSV
- CSV files for guest import
- Maximum size: 2MB

### Upload Endpoints

#### Profile Image
```http
POST /api/users/upload-avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

#### Event Images
```http
POST /api/events/:id/upload-images
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

## Pagination

All list endpoints support pagination:

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)
- `sortBy` - Field to sort by
- `sortOrder` - `asc` or `desc` (default: `desc`)

**Response includes pagination info:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## 🔒 Security Features

- JWT authentication with refresh tokens
- Password hashing with bcrypt
- Rate limiting on all endpoints
- Input validation with Zod
- SQL injection prevention with Prisma
- File upload security
- Helmet.js for security headers
- CORS configuration

## 🧪 Testing

### Sample Test Accounts

**Admin Account:**
- Email: `admin@tanzaniaevents.com`
- Password: `Admin123!`

**Regular User:**
- Email: `john.mushi@example.com`
- Password: `User123!`

### Test Data

The platform includes comprehensive test data:
- 4 Safari tour packages
- 3 Vehicle rental options
- 3 Accommodation options
- 3 Event venues
- 4 Decoration packages
- E-card templates with Tanzanian themes

### Run Tests
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## 📊 Database

The application uses PostgreSQL with Prisma ORM. The database schema includes:

- Users and authentication
- Events and invitations
- E-cards and templates
- Service catalogs (tours, vehicles, accommodations, venues, decorations)
- Bookings and payments
- Notifications and messaging
- Analytics and reporting

### Database Commands

```bash
# Generate Prisma client
npm run db:generate

# Create and apply migration
npm run db:migrate

# Reset database
npm run db:reset

# Seed database with sample data
npm run db:seed
```

## 🐳 Docker Deployment

### Using Docker Compose

1. **Set up environment**
   ```bash
   cp env.example .env
   # Configure your environment variables
   ```

2. **Start all services**
   ```bash
   docker-compose up -d
   ```

This will start:
- PostgreSQL database
- Redis (for caching)
- The API server
- Nginx (reverse proxy)

### Manual Docker Build

```bash
# Build the image
docker build -t tanzania-events-api .

# Run the container
docker run -p 3000:3000 --env-file .env tanzania-events-api
```

## 📈 Development

### Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format code with Prettier
```

### Code Quality

The project uses:
- **ESLint** for code linting
- **Prettier** for code formatting
- **TypeScript** for type safety
- **Husky** for Git hooks (if configured)

## Sample Data

The seeded database includes:
- Tanzania venues (Dar es Salaam, Arusha, Zanzibar)
- Safari tour packages with realistic TZS pricing
- Local vehicle fleet
- Accommodation options across Tanzania
- Cultural e-card templates

## Webhooks

The platform supports webhooks for external integrations:

### Event RSVP Updates
```
POST /webhooks/rsvp-update
```

### Booking Status Changes
```
POST /webhooks/booking-update
```

### Payment Confirmations
```
POST /webhooks/payment-confirmation
```

## 🔮 Future Enhancements

- [ ] Complete service module implementations (Accommodations, Venues, Decorations, etc.)
- [ ] Real-time chat for event coordination
- [ ] Mobile app API optimization
- [ ] Advanced analytics dashboard
- [ ] Integration with local payment gateways
- [ ] Multi-language support (English/Swahili)
- [ ] Advanced booking management
- [ ] Vendor management system

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Email: support@tanzaniaevents.com
- Documentation: [API Docs](http://localhost:3000/api)
- Health Check: [http://localhost:3000/health](http://localhost:3000/health)

---

**Made with ❤️ for Tanzania's event planning community**# afyatrack-backend
