# Email Configuration for WEXP API

## Namecheap Email Settings

Based on your Namecheap email credentials, here are the environment variables you need to set:

### Required Environment Variables

Add these to your `.env` file in the `backend` directory:

```bash
# Email Configuration - Namecheap Settings
SMTP_HOST="mail.ufumbuzilabs.com"
SMTP_PORT=587
SMTP_USER="wexp@ufumbuzilabs.com"
SMTP_PASS="&l8[e&lQ{Ha?"
FROM_EMAIL="wexp@ufumbuzilabs.com"
FROM_NAME="WEXP - Tanzania Events Platform"
```

### Complete .env Template

Create a `.env` file in your `backend` directory with these settings:

```bash
# Database
DATABASE_PATH="./database.sqlite"

# JWT Secrets - CHANGE THESE IN PRODUCTION
JWT_SECRET="your-super-secret-jwt-key-here-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-here-change-in-production"
JWT_EXPIRE_TIME="1h"
JWT_REFRESH_EXPIRE_TIME="7d"

# Server Configuration
PORT=3000
NODE_ENV="development"
CORS_ORIGIN="http://localhost:3000"

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR="./uploads"

# Email Configuration - Namecheap Settings
SMTP_HOST="mail.ufumbuzilabs.com"
SMTP_PORT=587
SMTP_USER="wexp@ufumbuzilabs.com"
SMTP_PASS="&l8[e&lQ{Ha?"
FROM_EMAIL="wexp@ufumbuzilabs.com"
FROM_NAME="WEXP - Tanzania Events Platform"

# Admin Configuration
ADMIN_EMAIL="wexp@ufumbuzilabs.com"
ADMIN_PASSWORD="SecurePassword123!"

# Optional: Add other services as needed
BEEM_API_KEY=""
BEEM_SECRET_KEY=""
WHATSAPP_TOKEN=""
WHATSAPP_PHONE_ID=""
```

## Email Configuration Details

### SMTP Settings Explained:

- **Host**: `mail.ufumbuzilabs.com` - Namecheap's mail server for your domain
- **Port**: `587` - Standard port for STARTTLS (secure email submission)
- **Security**: STARTTLS encryption (not SSL/465)
- **Authentication**: Required using your email credentials

### Supported Email Features:

1. **User Registration Emails** - Welcome and verification emails
2. **Event Invitations** - Beautiful HTML email templates
3. **Password Reset Emails** - Secure reset links
4. **Event Notifications** - Updates and reminders
5. **System Notifications** - Admin alerts and logs

### Testing Email Configuration

Once you've set up the `.env` file, restart your server:

```bash
npm run dev
```

Look for this log message:

```
Email transporter is ready
```

If you see an error, check:

1. Your email credentials are correct
2. Your domain's email service is active
3. Firewall allows outbound connections on port 587

### Alternative Ports (if 587 doesn't work):

- Port `465` with SSL (change SMTP_PORT=465)
- Port `25` for basic SMTP (not recommended for production)

### Security Notes:

- Keep your email password secure
- Consider using an app-specific password if available
- In production, use environment variable management (not .env files)
- Enable 2FA on your email account for additional security

## Need Help?

- Check server logs for specific error messages
- Verify your Namecheap email settings in their control panel
- Test email connectivity with telnet: `telnet mail.ufumbuzilabs.com 587`
