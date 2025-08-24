# Email Delivery Monitoring Guide

## 1. Real-time Server Logs

When running `npm run dev`, watch for these messages:

### Email Connection Status:

- ✅ `Email transporter is ready` - SMTP connection successful
- ❌ `Email transporter verification failed` - SMTP connection failed

### Email Sending:

- ✅ `Email sent to user@example.com` - Email sent successfully
- ❌ `Failed to send email to user@example.com: [error]` - Email failed

## 2. Database Message Logs

All email attempts are logged in the `message_logs` table.

### Check Email Status via API

**GET** `/api/messages/{messageId}/status`

```json
{
  "id": "clxxxxx",
  "status": "SENT" | "FAILED" | "PENDING",
  "deliveredAt": "2025-01-24T10:30:00Z",
  "errorMessage": "Connection timeout" // if failed
}
```

### Direct Database Query

Connect to your SQLite database and run:

```sql
-- Check recent email logs
SELECT
  id,
  recipient,
  subject,
  status,
  created_at,
  delivered_at,
  error_message
FROM message_logs
WHERE method = 'EMAIL'
ORDER BY created_at DESC
LIMIT 10;

-- Count email status
SELECT
  status,
  COUNT(*) as count
FROM message_logs
WHERE method = 'EMAIL'
GROUP BY status;
```

## 3. Test Email Endpoint

Create a test endpoint to send emails and check status:

### Test Registration Email

**POST** `/api/auth/register`

```json
{
  "email": "test@yourdomain.com",
  "password": "Test123!",
  "firstName": "Test",
  "lastName": "User",
  "businessType": "INDIVIDUAL"
}
```

Response will include any email sending errors.

## 4. Email Configuration Testing

### Current SMTP Settings Check:

```bash
# In your .env file, verify:
SMTP_HOST="mail.ufumbuzilabs.com"
SMTP_PORT=587
SMTP_USER="wexp@ufumbuzilabs.com"
SMTP_PASS="&l8[e&lQ{Ha?"
FROM_EMAIL="wexp@ufumbuzilabs.com"
```

### Test SMTP Connection Manually:

```bash
# Test if SMTP server is reachable
telnet mail.ufumbuzilabs.com 587

# Check DNS resolution
nslookup mail.ufumbuzilabs.com
```

## 5. Common Email Issues & Solutions

### Issue: "Email transporter verification failed"

**Causes:**

- Wrong SMTP host/port
- Invalid credentials
- Firewall blocking port 587
- ISP blocking SMTP

**Solutions:**

1. Try different SMTP settings:

   ```bash
   # Option 1: Namecheap Private Email
   SMTP_HOST="mail.privateemail.com"

   # Option 2: SSL instead of STARTTLS
   SMTP_PORT=465

   # Option 3: Different server
   SMTP_HOST="smtp.privateemail.com"
   ```

2. Check Namecheap email settings in control panel
3. Contact Namecheap support for correct SMTP settings

### Issue: Emails sent but not received

**Check:**

- Recipient's spam folder
- Email content not triggering spam filters
- FROM_EMAIL matches your domain
- Proper email formatting

## 6. Email Delivery Monitoring Dashboard

You can create a simple monitoring endpoint:

**GET** `/api/admin/email-stats`

```json
{
  "total_sent": 150,
  "total_failed": 5,
  "last_24h": {
    "sent": 25,
    "failed": 1
  },
  "recent_failures": [
    {
      "recipient": "user@example.com",
      "error": "Connection timeout",
      "timestamp": "2025-01-24T10:30:00Z"
    }
  ]
}
```

## 7. Quick Email Test

### Send a test email via API:

**POST** `/api/test/email`

```json
{
  "to": "your-email@example.com",
  "subject": "Test Email from WEXP API",
  "text": "This is a test email to verify SMTP configuration."
}
```

### Expected responses:

- ✅ Success: `{ "success": true, "messageId": "clxxxxx" }`
- ❌ Failure: `{ "success": false, "error": "SMTP connection failed" }`

## 8. Troubleshooting Steps

1. **Check server logs** for SMTP connection errors
2. **Verify .env configuration** matches your email provider
3. **Test different SMTP settings** if connection fails
4. **Check database logs** for email sending attempts
5. **Monitor recipient spam folders**
6. **Contact email provider** if issues persist

## 9. Production Monitoring

For production, consider:

- Setting up email delivery webhooks
- Using email service providers (SendGrid, Mailgun)
- Implementing retry logic for failed emails
- Regular monitoring of email delivery rates
