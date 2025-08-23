# 🚀 Tanzania Event Platform - Production Deployment Guide

Deploy your Tanzania Event Platform to **server1.ufumbuzilabs.com** (203.161.60.72)

## 📋 Prerequisites

- **VPS Server**: Namecheap VPS with Ubuntu 20.04+
- **Domain**: server1.ufumbuzilabs.com pointing to 203.161.60.72
- **SSH Access**: Root access to the server
- **Git Repository**: Your code repository (GitHub/GitLab)

## 🏗️ Architecture Overview

```
[Internet] → [Cloudflare/DNS] → [Nginx] → [API Container] → [PostgreSQL + Redis]
                                   ↓
                              [SSL Certificates]
                              [File Uploads]
                              [Logging]
```

## 🔧 Step 1: Initial Server Setup

### Connect to your server:

```bash
ssh root@203.161.60.72
```

### Run the server setup script:

```bash
# Download and run server setup
wget https://raw.githubusercontent.com/yourusername/tanzania-event-platform-backend/main/scripts/server-setup.sh
chmod +x server-setup.sh
sudo ./server-setup.sh
```

This script will:

- ✅ Install Docker & Docker Compose
- ✅ Configure firewall (UFW)
- ✅ Setup fail2ban for security
- ✅ Create application user
- ✅ Optimize system performance
- ✅ Setup monitoring tools

## 🔑 Step 2: Setup SSH Key Access

```bash
# On your local machine, copy SSH key to app user
ssh-copy-id appuser@203.161.60.72

# Test connection
ssh appuser@203.161.60.72
```

## 🌐 Step 3: DNS Configuration

Update your DNS records to point to your server:

| Type  | Name                     | Value                    | TTL |
| ----- | ------------------------ | ------------------------ | --- |
| A     | server1.ufumbuzilabs.com | 203.161.60.72            | 300 |
| CNAME | www.ufumbuzilabs.com     | server1.ufumbuzilabs.com | 300 |

## 📦 Step 4: Deploy Application

### Login as application user:

```bash
ssh appuser@203.161.60.72
```

### Clone your repository:

```bash
# Update the repository URL with your actual repo
git clone https://github.com/yourusername/tanzania-event-platform-backend.git /opt/tanzania-event-platform
cd /opt/tanzania-event-platform
```

### Configure environment variables:

```bash
# Copy production environment template
cp production.env .env

# Edit with your production values
nano .env
```

**⚠️ CRITICAL: Update these values in `.env`:**

```bash
# Database (Generate secure password)
DB_PASSWORD="YourSecureDBPassword123!"

# JWT Secrets (Generate with: openssl rand -hex 64)
JWT_SECRET="your-super-secure-production-jwt-key"
JWT_REFRESH_SECRET="your-super-secure-production-refresh-key"

# Domain configuration
CORS_ORIGIN="https://server1.ufumbuzilabs.com,https://ufumbuzilabs.com"

# Email configuration
SMTP_USER="noreply@ufumbuzilabs.com"
SMTP_PASS="your-app-password"

# Tanzania SMS providers
BEEM_API_KEY="your-beem-api-key"
BEEM_SECRET_KEY="your-beem-secret-key"

# WhatsApp Business API
WHATSAPP_TOKEN="your-whatsapp-token"
WHATSAPP_PHONE_ID="your-phone-id"

# Payment gateways
MPESA_CONSUMER_KEY="your-mpesa-key"
MPESA_CONSUMER_SECRET="your-mpesa-secret"
```

### Deploy the application:

```bash
# Make deploy script executable
chmod +x scripts/deploy.sh

# Run deployment
./scripts/deploy.sh deploy
```

## 🔒 Step 5: Setup SSL Certificates

```bash
# Setup Let's Encrypt SSL certificates
./scripts/deploy.sh ssl
```

## 🏥 Step 6: Verify Deployment

### Check service status:

```bash
# View running containers
docker-compose -f docker-compose.prod.yml ps

# Check application logs
docker-compose -f docker-compose.prod.yml logs -f api

# Test API health
curl https://server1.ufumbuzilabs.com/health
```

### Expected response:

```json
{
  "success": true,
  "message": "Service is healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "database": "connected"
}
```

## 🛠️ Management Commands

### Application Management:

```bash
# Check status
./scripts/deploy.sh status

# View logs
./scripts/deploy.sh logs

# Update application
./scripts/deploy.sh update

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Start all services
docker-compose -f docker-compose.prod.yml up -d
```

### Database Management:

```bash
# Create backup
./scripts/backup.sh backup

# List backups
./scripts/backup.sh list

# Restore from backup
./scripts/backup.sh restore /opt/backups/db_backup_20240115_103000.sql.gz

# Connect to database
docker-compose -f docker-compose.prod.yml exec db psql -U tanzaniaevents -d tanzania_event_platform
```

### System Monitoring:

```bash
# System status
system-monitor

# Docker resources
docker system df

# Container stats
docker stats

# View firewall status
sudo ufw status

# Check fail2ban
sudo fail2ban-client status
```

## 🔧 Configuration Files

| File                      | Purpose                           |
| ------------------------- | --------------------------------- |
| `production.env`          | Production environment variables  |
| `docker-compose.prod.yml` | Production Docker configuration   |
| `nginx/nginx.conf`        | Nginx reverse proxy configuration |
| `scripts/deploy.sh`       | Deployment automation script      |
| `scripts/backup.sh`       | Database backup script            |

## 📊 Monitoring & Logs

### Application Logs:

```bash
# API logs
docker-compose -f docker-compose.prod.yml logs -f api

# Database logs
docker-compose -f docker-compose.prod.yml logs -f db

# Nginx logs
docker-compose -f docker-compose.prod.yml logs -f nginx

# All services
docker-compose -f docker-compose.prod.yml logs -f
```

### System Logs:

```bash
# Application logs
tail -f /opt/tanzania-event-platform/logs/app.log

# Nginx access logs
tail -f /var/log/nginx/access.log

# System logs
journalctl -f -u docker
```

## 🔐 Security Features

### Implemented Security:

- ✅ **Firewall**: UFW configured with minimal open ports
- ✅ **Fail2ban**: Intrusion prevention system
- ✅ **SSL/TLS**: Let's Encrypt certificates with auto-renewal
- ✅ **Container Security**: Non-root user in containers
- ✅ **Rate Limiting**: API rate limiting via Nginx
- ✅ **Headers**: Security headers (HSTS, CSP, etc.)
- ✅ **Network Isolation**: Docker networks for service isolation

### Security Headers Added:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
X-Content-Type-Options: nosniff
Content-Security-Policy: default-src 'self'
```

## 🚨 Troubleshooting

### Common Issues:

#### 1. **Application won't start**

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs api

# Check environment
docker-compose -f docker-compose.prod.yml exec api env | grep -E "(DB|JWT)"

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

#### 2. **Database connection errors**

```bash
# Check database health
docker-compose -f docker-compose.prod.yml exec db pg_isready -U tanzaniaevents

# Check database logs
docker-compose -f docker-compose.prod.yml logs db

# Reset database (CAUTION: This will lose data)
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d
```

#### 3. **SSL certificate issues**

```bash
# Renew certificates
./scripts/deploy.sh ssl

# Check certificate status
openssl s_client -connect server1.ufumbuzilabs.com:443 -servername server1.ufumbuzilabs.com

# Manual certificate renewal
docker-compose -f docker-compose.prod.yml run --rm certbot renew
```

#### 4. **High memory usage**

```bash
# Check container resources
docker stats

# Restart containers
docker-compose -f docker-compose.prod.yml restart

# Check system resources
free -h
top
```

### Performance Optimization:

#### 1. **Database Performance**

```sql
-- Connect to database and check performance
\l  -- List databases
\dt -- List tables
SELECT * FROM pg_stat_activity;  -- Active connections
```

#### 2. **Application Performance**

```bash
# Check API response times
curl -w "@curl-format.txt" -o /dev/null -s https://server1.ufumbuzilabs.com/health

# Monitor application metrics
docker-compose -f docker-compose.prod.yml exec api npm run health-check
```

## 🔄 Backup & Recovery

### Automated Backups:

- **Daily backups** at 2:00 AM (configured via cron)
- **30-day retention** policy
- **Compressed backups** to save space
- **Integrity verification** after each backup

### Manual Backup:

```bash
./scripts/backup.sh backup
```

### Disaster Recovery:

```bash
# 1. Stop application
docker-compose -f docker-compose.prod.yml stop api

# 2. Restore database
./scripts/backup.sh restore /opt/backups/db_backup_latest.sql.gz

# 3. Start application
docker-compose -f docker-compose.prod.yml start api
```

## 📞 Support

### API Endpoints:

- **Health Check**: https://server1.ufumbuzilabs.com/health
- **API Documentation**: https://server1.ufumbuzilabs.com/api
- **Admin Panel**: https://server1.ufumbuzilabs.com/admin

### Support Contacts:

- **Technical Support**: admin@ufumbuzilabs.com
- **Emergency**: +255 XXX XXX XXX

---

## 🎉 Success!

Your Tanzania Event Platform is now live at:
**https://server1.ufumbuzilabs.com**

Ready to manage events, send invitations, and provide services across Tanzania! 🇹🇿

