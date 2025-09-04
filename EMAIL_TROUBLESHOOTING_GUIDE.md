# Email Service Troubleshooting Guide

## Current Issues Identified

Based on our diagnostics, we've identified the following issues with your email configuration:

### 1. Primary SMTP Server Issues
- **mail.ufumbuzilabs.com**: Connection timeout on all ports (587, 465, 25)
- This suggests the email service might not be properly activated or configured in your domain settings

### 2. Alternative Server Authentication Issues  
- **mail.privateemail.com**: Server is reachable but authentication fails
- This indicates wrong server settings or account configuration

## Recommended Solutions

### Option 1: Fix Domain Email Configuration

1. **Log into your domain provider (Namecheap) control panel**
2. **Navigate to Email section** and verify:
   - Email service is activated
   - MX records are properly configured
   - Email account `wexp@ufumbuzilabs.com` is created and active

3. **Check email settings** in your hosting provider:
   - Server: Should be `mail.ufumbuzilabs.com` or `mail.privateemail.com`
   - Ports: 587 (STARTTLS) or 465 (SSL)
   - Username: Full email address `wexp@ufumbuzilabs.com`
   - Password: Correct password (check for special characters)

### Option 2: Use Gmail SMTP (Temporary Solution)

Update your `.env` file with Gmail SMTP settings:

```bash
# Gmail SMTP Configuration (Alternative)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-gmail@gmail.com"
SMTP_PASS="your-app-password"  # Use App Password, not regular password
FROM_EMAIL="your-gmail@gmail.com"
FROM_NAME="WEXP - Tanzania Events Platform"
```

**To set up Gmail App Password:**
1. Enable 2-factor authentication on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Generate an app password for "Mail"
4. Use this 16-character password in `SMTP_PASS`

### Option 3: Use Other SMTP Services

#### SendGrid (Recommended for Production)
```bash
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT=587
SMTP_USER="apikey"
SMTP_PASS="your-sendgrid-api-key"
FROM_EMAIL="wexp@ufumbuzilabs.com"
FROM_NAME="WEXP - Tanzania Events Platform"
```

#### Mailgun
```bash
SMTP_HOST="smtp.mailgun.org"
SMTP_PORT=587
SMTP_USER="your-mailgun-username"
SMTP_PASS="your-mailgun-password"
FROM_EMAIL="wexp@ufumbuzilabs.com"
FROM_NAME="WEXP - Tanzania Events Platform"
```

## Testing Your Configuration

After updating your email settings, test using:

```bash
# Test with our diagnostic script
node test-email.js

# Or test through the API (after starting the server)
npm run dev

# Then make a POST request to:
POST http://localhost:3001/api/communications/test-email
{
  "to": "your-test-email@gmail.com"
}
```

## Common Issues & Solutions

### 1. Authentication Failed (535 Error)
- **Cause**: Wrong username, password, or server settings
- **Solution**: Double-check credentials and server settings in domain control panel

### 2. Connection Timeout (ETIMEDOUT)
- **Cause**: Server not accessible or firewall blocking
- **Solution**: Verify server address, try alternative ports, check firewall

### 3. Certificate Issues (TLS/SSL Errors)  
- **Cause**: SSL certificate problems
- **Solution**: Add `tls: { rejectUnauthorized: false }` to SMTP config

### 4. Port Blocked
- **Cause**: ISP or firewall blocking SMTP ports
- **Solution**: Try alternative ports (587, 465, 25) or contact ISP

## Production Recommendations

1. **Use dedicated email service** (SendGrid, Mailgun, AWS SES)
2. **Set up SPF, DKIM, DMARC records** for better delivery
3. **Monitor email delivery rates** and bounces
4. **Implement retry logic** for failed emails
5. **Use email templates** for consistent branding

## Next Steps

1. **Immediate**: Use Gmail SMTP to get email working
2. **Short-term**: Fix your domain email configuration  
3. **Long-term**: Migrate to professional email service

## Support

If you continue having issues:
1. Check with your domain provider about email service status
2. Verify email account exists and is active
3. Test email settings with a desktop email client first
4. Consider switching to a dedicated email service provider
