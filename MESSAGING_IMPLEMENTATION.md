# WEXP Messaging Implementation

## Overview

This document describes the comprehensive messaging system implementation for the WEXP platform, integrating the messaging-service.co.tz API for SMS functionality along with existing email capabilities.

## Architecture

### Core Components

1. **SMS Service (`src/services/smsService.ts`)**
   - Direct integration with messaging-service.co.tz API
   - Phone number validation for Tanzania
   - Bulk messaging support
   - Error handling and logging
   - Health checks

2. **Enhanced Communication Service (`src/services/communicationService.ts`)**
   - Unified interface for SMS, Email, and WhatsApp
   - Template-based messaging
   - Multi-channel notifications
   - Message logging and status tracking

3. **Message Templates (`src/utils/messageTemplates.ts`)**
   - Pre-defined SMS and Email templates
   - Localized content (English/Swahili)
   - Dynamic content injection
   - Template validation and utilities

4. **Messaging Controller (`src/controllers/messagingController.ts`)**
   - RESTful API endpoints
   - Authentication and authorization
   - Rate limiting
   - Error handling

5. **API Routes (`src/routes/messagingRoutes.ts`)**
   - Comprehensive routing
   - Swagger documentation
   - Input validation
   - Security middleware

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# SMS Configuration (messaging-service.co.tz)
SMS_PROVIDER=messaging-service
MESSAGING_SERVICE_USERNAME=justinecodez
MESSAGING_SERVICE_PASSWORD=YTj5BM8wtaTJHA@
MESSAGING_SERVICE_API_URL=https://messaging-service.co.tz/api/sms/v1/text/single
MESSAGING_SERVICE_DEFAULT_FROM=Wexp Card
```

### Service Configuration

The system automatically configures the SMS service using the provided credentials:
- Username: `justinecodez`
- Password: `YTj5BM8wtaTJHA@`
- API URL: `https://messaging-service.co.tz/api/sms/v1/text/single`
- Default Sender: `Wexp Card`

## API Endpoints

### Base URL: `/api/messaging`

#### 1. Health Check
```http
GET /health
```
Returns the health status of all messaging services (SMS, Email, WhatsApp).

#### 2. Send SMS
```http
POST /sms/send
Content-Type: application/json

{
  "to": "255658123881",
  "message": "Your message content",
  "from": "Wexp Card" // optional
}
```

#### 3. Send Bulk SMS
```http
POST /sms/bulk
Content-Type: application/json

{
  "recipients": ["255658123881", "255757714834"],
  "message": "Bulk message content",
  "from": "Wexp Card" // optional
}
```

#### 4. Send Email
```http
POST /email/send
Content-Type: application/json

{
  "to": "user@example.com",
  "subject": "Email subject",
  "html": "<h1>HTML content</h1>",
  "text": "Plain text content" // optional
}
```

#### 5. Send Welcome Notification
```http
POST /welcome
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com", // optional
  "phone": "255658123881" // optional
}
```

#### 6. Send Verification Code
```http
POST /verification
Content-Type: application/json

{
  "contact": "255658123881",
  "method": "sms" // or "email"
}
```

#### 7. Send Event Notifications
```http
POST /event/notify
Content-Type: application/json

{
  "eventData": {
    "title": "Wedding Celebration",
    "date": "2024-01-15T14:00:00Z",
    "location": "Dar es Salaam, Tanzania",
    "organizerName": "Jane Smith",
    "rsvpLink": "https://wexp.co.tz/rsvp/event123"
  },
  "recipients": [
    {
      "phone": "255658123881",
      "email": "guest@example.com",
      "name": "Guest Name"
    }
  ],
  "notificationType": "invitation" // or "reminder_24h", "reminder_1h", "cancellation"
}
```

#### 8. Send Payment Confirmation
```http
POST /payment/confirmation
Content-Type: application/json

{
  "contact": {
    "phone": "255658123881",
    "email": "customer@example.com"
  },
  "paymentData": {
    "amount": 50000,
    "currency": "TZS",
    "eventTitle": "Wedding Planning Service",
    "transactionId": "TXN123456789"
  }
}
```

#### 9. Send Template Message
```http
POST /template/send
Content-Type: application/json

{
  "templateType": "welcome", // or "verification", "event_invitation", "payment_confirmation", "custom"
  "templateData": {
    "name": "User Name",
    // additional template-specific data
  },
  "recipient": "255658123881",
  "method": "sms" // or "email"
}
```

#### 10. Get Message Status
```http
GET /status/{messageId}
```

#### 11. Validate Phone Number
```http
POST /validate/phone
Content-Type: application/json

{
  "phone": "255658123881"
}
```

#### 12. Get Available Templates
```http
GET /templates
```

## Message Templates

### SMS Templates

1. **Welcome Message**
   ```
   Karibu {name}! Welcome to WEXP - your premier event planning platform in Tanzania. Start creating amazing events today! Visit wexp.co.tz
   ```

2. **Verification Code**
   ```
   Your WEXP {purpose} code is: {code}. This code expires in {expiry} minutes. Do not share this code with anyone.
   ```

3. **Event Invitation**
   ```
   🎉 Karibu! You're invited to "{title}" on {date} at {time}. Location: {location}. RSVP: {rsvpLink} - {organizerName}
   ```

4. **Event Reminder (24h)**
   ```
   ⏰ Reminder: "{title}" is tomorrow ({date}) at {time}. Location: {location}. See you there!
   ```

5. **Event Reminder (1h)**
   ```
   🔔 Final reminder: "{title}" starts in 1 hour at {time}. Location: {location}. Don't miss it!
   ```

6. **Payment Confirmation**
   ```
   ✅ Payment confirmed! {amount} received for "{eventTitle}". Transaction ID: {transactionId}. Thank you for using WEXP!
   ```

### Email Templates

All email templates use responsive HTML with WEXP branding and include:
- Professional header with gradient background
- Structured content with clear typography
- Call-to-action buttons
- Footer with contact information
- Mobile-responsive design

## Integration Points

### User Registration
When a user registers, the system automatically:
1. Sends email verification (existing functionality)
2. Sends welcome SMS and/or email notification (new functionality)

### Event Management
Integration points for event-related notifications:
- Event invitations (SMS + Email)
- Event reminders (24h and 1h before)
- Event cancellations
- RSVP confirmations

### Payment Processing
Integration with payment systems to send:
- Payment confirmations
- Payment reminders
- Receipt delivery

## Phone Number Validation

The system includes comprehensive validation for Tanzanian phone numbers:
- Supports formats: +255XXXXXXXXX, 255XXXXXXXXX, 0XXXXXXXXX
- Validates network operators (Vodacom, Airtel, Tigo, etc.)
- Automatically formats numbers for API compatibility

## Error Handling and Logging

### Comprehensive Logging
- Message sending attempts
- Delivery status tracking
- Error details and stack traces
- Performance metrics
- Rate limiting violations

### Error Recovery
- Automatic retry mechanisms
- Fallback messaging channels
- Graceful degradation
- User notification of failures

## Rate Limiting

### API Rate Limits
- General messaging: 10 requests/minute
- SMS specific: 5 requests/minute
- Email specific: 10 requests/minute
- Bulk operations: 2 requests/minute

### SMS Provider Limits
- Respects messaging-service.co.tz rate limits
- Implements delays between bulk messages
- Monitors API quotas and usage

## Security

### Authentication
- All messaging endpoints require JWT authentication
- Role-based access control
- Request validation and sanitization

### Data Protection
- Sensitive credentials stored as environment variables
- Message content logging excludes PII
- Secure transmission over HTTPS

### Rate Protection
- Multiple layers of rate limiting
- IP-based restrictions
- User-based quotas

## Testing

### Test Script
A comprehensive test script (`test-messaging.js`) is provided to test:
1. Health check functionality
2. Phone number validation
3. SMS sending
4. Email sending
5. Template messaging
6. Event notifications
7. Verification codes

### Usage
```bash
node test-messaging.js
```

### Manual Testing with cURL
```bash
# Test SMS sending directly
curl --location 'https://messaging-service.co.tz/api/sms/v1/text/single' \
--header 'Authorization: Basic anVzdGluZWNvZGV6OllUajVCTTh3dGFUSkhBQA==' \
--header 'Content-Type: application/json' \
--header 'Accept: application/json' \
--data '{
    "from": "Wexp Card",
    "to": ["255658123881"],
    "text": "Test message from WEXP",
    "reference": "test_123"
}'
```

## Monitoring and Analytics

### Health Monitoring
- Service availability checks
- API response time monitoring
- Error rate tracking
- Message delivery statistics

### Business Analytics
- Message volume by type
- User engagement rates
- Cost analysis per message
- Geographic distribution

## Deployment Considerations

### Environment Setup
1. Configure environment variables
2. Install required dependencies (`axios`, `date-fns`)
3. Ensure network connectivity to messaging-service.co.tz
4. Set up monitoring and alerting

### Production Settings
- Enable production logging levels
- Configure appropriate rate limits
- Set up health check endpoints
- Implement proper error alerting

## Future Enhancements

### Planned Features
1. WhatsApp Business API integration
2. Push notification support
3. Message scheduling
4. A/B testing for templates
5. Advanced analytics dashboard
6. Multi-language support
7. Message personalization engine

### Scalability Considerations
- Message queue implementation
- Load balancing for high volume
- Database optimization for message logs
- Caching for template rendering

## Troubleshooting

### Common Issues
1. **SMS Not Sending**
   - Check credentials and API connectivity
   - Verify phone number format
   - Check rate limits and quotas

2. **Authentication Errors**
   - Verify JWT token validity
   - Check user permissions
   - Ensure proper header format

3. **Template Errors**
   - Validate template data structure
   - Check required fields
   - Verify template type

### Debug Commands
```bash
# Check service health
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/messaging/health

# Validate phone number
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN" \
-d '{"phone":"255658123881"}' http://localhost:3000/api/messaging/validate/phone
```

## Support

For technical support or questions about the messaging implementation:
- Email: support@wexp.co.tz
- Documentation: This file
- API Documentation: `/api/docs` endpoint

---

**Implementation Status: ✅ Complete**
- ✅ SMS Service Integration
- ✅ Message Templates
- ✅ API Endpoints
- ✅ User Registration Integration
- ✅ Error Handling & Logging
- ✅ Rate Limiting
- ✅ Documentation
- ✅ Testing Scripts
