# WhatsApp Webhook Verification Troubleshooting

## Error: "The callback URL or verify token couldn't be validated"

This error means Meta cannot verify your webhook endpoint. Here are the most common causes and solutions:

## Common Issues & Solutions

### 1. ❌ Webhook URL Not Publicly Accessible

**Problem:** Your server is running locally and Meta cannot reach it.

**Solution:** Use ngrok to create a public tunnel:

```bash
# Install ngrok (if not installed)
brew install ngrok  # macOS
# or download from https://ngrok.com/download

# Start your backend server
cd wexp-backend
npm run dev  # Server runs on http://localhost:3001

# In another terminal, create tunnel
ngrok http 3001

# You'll get a URL like: https://abc123xyz.ngrok.io
# Use this URL in Meta Business Suite:
# https://abc123xyz.ngrok.io/webhooks/whatsapp
```

**Important:** 
- Meta requires HTTPS (ngrok provides this)
- Keep ngrok running while testing
- Free ngrok URLs change on restart (paid plans have stable URLs)

### 2. ❌ Verify Token Mismatch

**Problem:** The token in your `.env` doesn't match what you entered in Meta.

**Check:**
1. Your `.env` file has: `WHATSAPP_VERIFY_TOKEN=a9f396107eaff1d638396c0510147aaef235e1631303ea85c4e7a5c6fea87c2d`
2. Meta Business Suite webhook settings has the EXACT same token
3. Restart your backend server after changing `.env`

**Test locally:**
```bash
# Run the test script
cd wexp-backend
node test-webhook-verification.js
```

### 3. ❌ Server Not Running

**Problem:** Your backend server is not running.

**Solution:**
```bash
cd wexp-backend
npm run dev
# Make sure it's running on the port specified in .env (default: 3001)
```

### 4. ❌ Wrong Endpoint Path

**Problem:** The webhook URL path is incorrect.

**Correct paths:**
- ✅ `https://your-domain.com/webhooks/whatsapp`
- ✅ `https://abc123.ngrok.io/webhooks/whatsapp`
- ❌ `https://your-domain.com/api/webhooks/whatsapp` (WRONG - no /api prefix)

**Check your routes:**
- Webhook routes are mounted at `/webhooks` (not `/api/webhooks`)
- See `src/app.ts` line 237: `this.app.use('/webhooks', webhookRoutes)`

### 5. ❌ Endpoint Not Responding Correctly

**Problem:** The endpoint exists but doesn't return the challenge correctly.

**What Meta expects:**
- GET request to `/webhooks/whatsapp`
- Query params: `hub.mode=subscribe`, `hub.challenge=XXX`, `hub.verify_token=XXX`
- Response: Plain text with the challenge value (status 200)

**Test manually:**
```bash
# Replace with your actual URL and token
curl "http://localhost:3001/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=a9f396107eaff1d638396c0510147aaef235e1631303ea85c4e7a5c6fea87c2d"

# Should return: test123
```

### 6. ❌ Firewall or Network Issues

**Problem:** Your server is behind a firewall or not accessible.

**Solutions:**
- Use ngrok for development (bypasses firewall)
- For production, ensure your server has a public IP and firewall allows HTTPS (port 443)
- Check if your hosting provider blocks incoming connections

## Step-by-Step Verification

### Step 1: Test Locally

```bash
# Terminal 1: Start backend
cd wexp-backend
npm run dev

# Terminal 2: Test webhook endpoint
node test-webhook-verification.js
```

Expected output:
```
✅ Endpoint is accessible
✅ Challenge returned correctly - Verification should work!
```

### Step 2: Set Up Public Access (ngrok)

```bash
# Terminal 3: Start ngrok
ngrok http 3001

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

### Step 3: Configure in Meta Business Suite

1. Go to: https://business.facebook.com/
2. Navigate to: **Settings** → **WhatsApp** → **Configuration** → **Webhook**
3. Enter:
   - **Callback URL:** `https://abc123.ngrok.io/webhooks/whatsapp` (your ngrok URL)
   - **Verify Token:** `a9f396107eaff1d638396c0510147aaef235e1631303ea85c4e7a5c6fea87c2d` (from your .env)
4. Click **Verify and Save**

### Step 4: Check Server Logs

When Meta tries to verify, you should see in your backend logs:

```
🔐 WhatsApp Webhook Verification Request
✅ WhatsApp webhook verified successfully - Challenge returned
```

If you see errors, check:
- Token match status
- Mode value
- Challenge value

## Quick Checklist

- [ ] Backend server is running (`npm run dev`)
- [ ] Server is accessible (test with `curl` or test script)
- [ ] `.env` has `WHATSAPP_VERIFY_TOKEN` set
- [ ] Token in Meta matches token in `.env` exactly
- [ ] Using public URL (ngrok or your domain) in Meta
- [ ] Webhook URL ends with `/webhooks/whatsapp` (not `/api/webhooks/whatsapp`)
- [ ] Server logs show verification attempts
- [ ] ngrok is running (if using ngrok)

## Testing the Webhook Endpoint

### Manual Test with curl:

```bash
# Test with correct token
curl "http://localhost:3001/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=a9f396107eaff1d638396c0510147aaef235e1631303ea85c4e7a5c6fea87c2d"

# Should return: test123

# Test with wrong token (should return 403)
curl "http://localhost:3001/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=wrong_token"
```

### Using the Test Script:

```bash
cd wexp-backend
node test-webhook-verification.js
```

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Callback URL couldn't be validated" | URL not accessible | Use ngrok or ensure server is public |
| "Verify token couldn't be validated" | Token mismatch | Check `.env` and Meta settings match |
| "Connection timeout" | Server not running | Start backend server |
| "404 Not Found" | Wrong URL path | Use `/webhooks/whatsapp` (not `/api/webhooks/whatsapp`) |

## Still Having Issues?

1. **Check server logs** - Look for webhook verification attempts
2. **Test endpoint manually** - Use curl or the test script
3. **Verify environment variables** - Make sure `.env` is loaded
4. **Check ngrok status** - Ensure tunnel is active
5. **Restart server** - After changing `.env`, restart the backend

## Production Setup

For production, you'll need:
- A domain with SSL certificate (HTTPS required)
- Public IP address
- Firewall configured to allow HTTPS (port 443)
- Stable webhook URL (not ngrok)

Example production webhook URL:
```
https://api.yourapp.com/webhooks/whatsapp
```

