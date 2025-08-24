# 📧 Email Health Check Guide

## 🎯 New Health Check Endpoints

I've added email monitoring to your health check system! Here are the new endpoints:

### 1. **Main Health Check (Updated)**

```bash
GET http://localhost:3000/health
```

**Now includes email status:**

```json
{
  "success": true,
  "message": "All services are healthy",
  "timestamp": "2025-01-24T10:30:00Z",
  "uptime": 3600,
  "environment": "development",
  "services": {
    "database": {
      "status": "healthy",
      "message": "Connected"
    },
    "email": {
      "status": "healthy",
      "message": "Email service is operational",
      "details": {
        "host": "mail.ufumbuzilabs.com",
        "port": 587,
        "user": "wexp@ufumbuzilabs.com"
      }
    }
  }
}
```

### 2. **Dedicated Email Health Check (New)**

```bash
GET http://localhost:3000/health/email
```

**Email-specific health details:**

```json
{
  "success": true,
  "message": "Email service is operational",
  "timestamp": "2025-01-24T10:30:00Z",
  "service": "email",
  "details": {
    "host": "mail.ufumbuzilabs.com",
    "port": 587,
    "user": "wexp@ufumbuzilabs.com"
  }
}
```

## 🔍 Health Check Status Codes

### ✅ Healthy (Status 200)

- **Database**: Connected and responding
- **Email**: SMTP connection successful

### ❌ Unhealthy (Status 503)

- **Database**: Connection failed or disconnected
- **Email**: SMTP connection failed, timeout, or authentication error

## 📊 What Each Health Check Tests

### **Database Health Check:**

- ✅ Connection is initialized
- ✅ Can execute simple query (`SELECT 1`)

### **Email Health Check:**

- ✅ Email transporter is initialized
- ✅ SMTP server connection works
- ✅ Authentication is valid
- ✅ Can send emails

## 🚀 How to Use

### **Quick Service Check:**

```bash
# Check all services
curl http://localhost:3000/health

# Check only email
curl http://localhost:3000/health/email
```

### **Monitor Email Status:**

```bash
# Watch email health in real-time
watch -n 5 'curl -s http://localhost:3000/health/email | jq'
```

### **Automated Monitoring:**

```bash
# Simple script to check email health
#!/bin/bash
EMAIL_HEALTH=$(curl -s http://localhost:3000/health/email)
STATUS=$(echo $EMAIL_HEALTH | jq -r '.success')

if [ "$STATUS" = "true" ]; then
    echo "✅ Email service is healthy"
else
    echo "❌ Email service is down"
    echo $EMAIL_HEALTH | jq '.message'
fi
```

## 🔧 Common Email Health Issues

### **Connection Timeout**

```json
{
  "success": false,
  "message": "SMTP connection failed",
  "details": {
    "host": "mail.ufumbuzilabs.com",
    "port": 587,
    "user": "wexp@ufumbuzilabs.com"
  }
}
```

**Solutions:**

- Check internet connection
- Try different SMTP port (465)
- Verify SMTP host is correct

### **Authentication Failed**

```json
{
  "success": false,
  "message": "Authentication failed",
  "details": {
    "host": "mail.ufumbuzilabs.com",
    "port": 587,
    "user": "wexp@ufumbuzilabs.com"
  }
}
```

**Solutions:**

- Verify email credentials in `.env`
- Check if 2FA is enabled
- Try different SMTP server

### **Transporter Not Initialized**

```json
{
  "success": false,
  "message": "Email transporter not initialized"
}
```

**Solutions:**

- Check `.env` file has email configuration
- Restart the server
- Verify SMTP settings are correct

## 💡 Integration Tips

### **Load Balancer Health Checks:**

Use `/health` endpoint for load balancer health checks to ensure both database and email are working.

### **Monitoring Alerts:**

Set up monitoring alerts based on HTTP status codes:

- Status 200 = All healthy
- Status 503 = Service degraded

### **CI/CD Pipeline:**

Include health checks in deployment verification:

```bash
# Wait for service to be healthy
while [ "$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)" != "200" ]; do
  echo "Waiting for service to be healthy..."
  sleep 5
done
echo "Service is healthy!"
```

## 🎯 Next Steps

1. **Test the health checks** with your current setup
2. **Monitor email status** during registration testing
3. **Set up alerts** for when email service goes down
4. **Use in production** for monitoring and load balancing

Your API now provides comprehensive health monitoring for both database and email services! 🎉
