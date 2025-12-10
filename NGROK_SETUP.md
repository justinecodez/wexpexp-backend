# ngrok Setup Guide for WhatsApp Webhooks

## Quick Setup

### Step 1: Sign up for ngrok (Free)

1. Go to: https://dashboard.ngrok.com/signup
2. Sign up for a free account (takes 2 minutes)
3. Verify your email

### Step 2: Get Your Authtoken

1. After signing up, go to: https://dashboard.ngrok.com/get-started/your-authtoken
2. Copy your authtoken (looks like: `2abc123xyz...`)

### Step 3: Configure ngrok

Run this command (replace with your actual authtoken):

```bash
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```

### Step 4: Start ngrok Tunnel

```bash
# Make sure your backend is running first (on port 3001)
# Then in another terminal:
ngrok http 3001
```

You'll see output like:
```
Forwarding: https://abc123xyz.ngrok.io -> http://localhost:3001
```

### Step 5: Use ngrok URL in Meta

Use the HTTPS URL in Meta Business Suite:
- **Callback URL:** `https://abc123xyz.ngrok.io/webhooks/whatsapp`
- **Verify Token:** `a9f396107eaff1d638396c0510147aaef235e1631303ea85c4e7a5c6fea87c2d`

## Alternative: Use Cloudflare Tunnel (Free, No Signup Required)

If you don't want to sign up for ngrok, you can use Cloudflare Tunnel:

```bash
# Install cloudflared
brew install cloudflared

# Create tunnel
cloudflared tunnel --url http://localhost:3001
```

This will give you a public HTTPS URL without requiring signup.

## Alternative: Use localtunnel (Free, No Signup)

```bash
# Install
npm install -g localtunnel

# Create tunnel
lt --port 3001
```

## Important Notes

1. **Port Number:** Your backend runs on port **3001** (not 3000)
2. **Keep Tunnel Running:** Keep ngrok/cloudflared/localtunnel running while testing
3. **Free ngrok URLs Change:** Free ngrok URLs change on restart. For stable URLs, use paid plan or alternatives
4. **HTTPS Required:** Meta requires HTTPS - all these tools provide it

## Testing Your Webhook

Once ngrok is running, test the webhook endpoint:

```bash
# Replace with your ngrok URL
curl "https://abc123xyz.ngrok.io/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=a9f396107eaff1d638396c0510147aaef235e1631303ea85c4e7a5c6fea87c2d"
```

Should return: `test123`

