# Email Configuration Troubleshooting

## Current Issue

- SMTP connection timeout to `mail.ufumbuzilabs.com:587`
- Winston logger error when trying to log errors

## Fixed Issues ✅

1. **Winston Logger Error**: Fixed error handler to properly format error logs
2. **Email Transporter**: Added better error handling and connection timeouts

## Email Configuration Options to Try

### Option 1: Standard Namecheap SMTP

```bash
SMTP_HOST="mail.ufumbuzilabs.com"
SMTP_PORT=587
SMTP_USER="wexp@ufumbuzilabs.com"
SMTP_PASS="&l8[e&lQ{Ha?"
```

### Option 2: Namecheap Private Email SMTP

```bash
SMTP_HOST="mail.privateemail.com"
SMTP_PORT=587
SMTP_USER="wexp@ufumbuzilabs.com"
SMTP_PASS="&l8[e&lQ{Ha?"
```

### Option 3: SSL instead of STARTTLS

```bash
SMTP_HOST="mail.ufumbuzilabs.com"
SMTP_PORT=465
SMTP_USER="wexp@ufumbuzilabs.com"
SMTP_PASS="&l8[e&lQ{Ha?"
```

### Option 4: Alternative Namecheap Server

```bash
SMTP_HOST="smtp.privateemail.com"
SMTP_PORT=587
SMTP_USER="wexp@ufumbuzilabs.com"
SMTP_PASS="&l8[e&lQ{Ha?"
```

## Testing Each Configuration

1. **Stop your server** (Ctrl+C)
2. **Update your `.env` file** with one of the options above
3. **Restart your server**: `npm run dev`
4. **Check the logs** for:
   - ✅ "Email transporter is ready" (success)
   - ❌ "Email transporter verification failed" (try next option)

## Network Troubleshooting

### Test SMTP Connection Manually

```bash
# Test if the server is reachable
telnet mail.ufumbuzilabs.com 587

# Or use nslookup to check DNS
nslookup mail.ufumbuzilabs.com
```

### Common Issues & Solutions

1. **Firewall/Network Blocking**
   - Your ISP might block SMTP ports
   - Try different ports (587, 465, 25)
   - Test from a different network

2. **DNS Resolution**
   - The domain might not have proper MX records
   - Try using IP address instead of domain

3. **Credentials**
   - Verify email and password are correct
   - Check if 2FA is enabled (might need app password)

## Temporary Gmail Setup (for testing)

If Namecheap email continues to fail, temporarily use Gmail to test:

```bash
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-gmail@gmail.com"
SMTP_PASS="your-app-password"  # Not your regular password!
FROM_EMAIL="your-gmail@gmail.com"
FROM_NAME="WEXP - Test"
```

**Note**: Gmail requires an "App Password" for SMTP access.

## Next Steps

1. Try each SMTP configuration option
2. Check server logs for connection success/failure
3. If all fail, verify Namecheap email settings in their control panel
4. Contact Namecheap support for correct SMTP settings

## Current Server Status

- ✅ Winston logger error fixed
- ✅ Email error handling improved
- ✅ Connection timeouts added
- 🔄 Need to test SMTP configurations
