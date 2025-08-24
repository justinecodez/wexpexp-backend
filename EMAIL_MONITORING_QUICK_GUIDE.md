# 📧 Quick Email Monitoring Guide

## 🚀 How to Check if Emails Are Working

### 1. **Watch Server Logs (Easiest)**

Start your server and watch the console:

```bash
npm run dev
```

**Look for these messages:**

- ✅ `Email transporter is ready` = Email configured correctly
- ❌ `Email transporter verification failed` = SMTP connection problem
- ✅ `Email sent to user@example.com` = Email sent successfully
- ❌ `Failed to send email to user@example.com` = Email failed

### 2. **Test Email Endpoint (New!)**

I've created test endpoints for you:

**Send a test email:**

```bash
POST http://localhost:3000/api/test/email
Content-Type: application/json

{
  "to": "your-email@example.com",
  "subject": "Test from WEXP API",
  "text": "Testing email configuration"
}
```

**Response:**

- ✅ Success: `{"success": true, "message": "Test email sent successfully"}`
- ❌ Failure: `{"success": false, "error": "SMTP connection failed"}`

### 3. **Check Email Statistics**

```bash
GET http://localhost:3000/api/test/email-stats
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totals": {
      "sent": 25,
      "failed": 3,
      "total": 28
    },
    "last24h": {
      "sent": 5,
      "failed": 0
    },
    "recent_failures": [],
    "recent_successes": [
      {
        "recipient": "test@example.com",
        "subject": "Welcome to WEXP",
        "delivered_at": "2025-01-24T10:30:00Z"
      }
    ]
  }
}
```

### 4. **Get Recent Email Logs**

```bash
GET http://localhost:3000/api/test/email-logs?limit=10
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "clxxxxx",
      "recipient": "user@example.com",
      "subject": "Welcome Email",
      "status": "SENT",
      "createdAt": "2025-01-24T10:30:00Z",
      "deliveredAt": "2025-01-24T10:30:05Z",
      "errorMessage": null
    }
  ]
}
```

## 🔧 Quick SMTP Troubleshooting

### If emails aren't working:

1. **Check your `.env` file has:**

   ```bash
   SMTP_HOST="mail.ufumbuzilabs.com"
   SMTP_PORT=587
   SMTP_USER="wexp@ufumbuzilabs.com"
   SMTP_PASS="&l8[e&lQ{Ha?"
   FROM_EMAIL="wexp@ufumbuzilabs.com"
   FROM_NAME="WEXP - Tanzania Events Platform"
   ```

2. **Try alternative SMTP settings:**

   ```bash
   # Option 1: Private Email
   SMTP_HOST="mail.privateemail.com"

   # Option 2: SSL Port
   SMTP_PORT=465

   # Option 3: Alternative server
   SMTP_HOST="smtp.privateemail.com"
   ```

3. **Test SMTP connection manually:**
   ```bash
   telnet mail.ufumbuzilabs.com 587
   ```

## 📍 Quick Test Process

1. **Start server:** `npm run dev`
2. **Watch logs** for "Email transporter is ready"
3. **Send test email** via API endpoint
4. **Check your inbox** (and spam folder)
5. **View email stats** to confirm delivery

## 🚨 Common Issues

- **Connection timeout** → Try different SMTP host/port
- **Authentication failed** → Verify email/password
- **Emails in spam** → Check FROM_EMAIL matches your domain
- **Port blocked** → Try port 465 instead of 587

## 💡 Pro Tips

- Always check spam folders when testing
- Use your own email for testing first
- Monitor the `/api/test/email-stats` endpoint regularly
- Check email logs after registration attempts
