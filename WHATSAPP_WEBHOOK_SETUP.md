# WhatsApp Webhook Setup Guide

This guide will help you set up WhatsApp webhooks to receive messages and status updates from Meta's WhatsApp Business API.

## Overview

Webhooks allow your application to receive real-time notifications when:
- Users send messages to your WhatsApp Business number
- Message delivery status changes (sent, delivered, read, failed)

## Prerequisites

1. WhatsApp Business API account set up in Meta Business Suite
2. Access Token and Phone Number ID configured
3. Backend server running and accessible from the internet (for production) or using ngrok (for development)

## Step 1: Configure Environment Variables

Add to your `.env` file:

```bash
# WhatsApp Webhook Configuration
WHATSAPP_VERIFY_TOKEN=your_custom_verify_token_here
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_API_VERSION=v18.0
```

**Important:** Choose a strong, random `WHATSAPP_VERIFY_TOKEN`. This is used to verify that webhook requests are coming from Meta.

Example:
```bash
WHATSAPP_VERIFY_TOKEN=wexp_webhook_secret_2024_abc123xyz
```

## Step 2: Webhook Endpoints

Your application exposes two webhook endpoints:

### 1. Webhook Verification (GET)
**URL:** `https://your-domain.com/webhooks/whatsapp`

**Purpose:** Meta calls this to verify your webhook URL during setup.

**Query Parameters:**
- `hub.mode` - Should be `subscribe`
- `hub.challenge` - Random string that you must echo back
- `hub.verify_token` - Must match your `WHATSAPP_VERIFY_TOKEN`

**Response:** Return the `hub.challenge` value as plain text with status 200.

### 2. Webhook Events (POST)
**URL:** `https://your-domain.com/webhooks/whatsapp`

**Purpose:** Meta sends message and status updates to this endpoint.

**Response:** Must return 200 within 20 seconds (even if processing continues asynchronously).

## Step 3: Set Up Webhook in Meta Business Suite

### For Production (Public URL):

1. **Go to Meta Business Suite:**
   - Visit: https://business.facebook.com/
   - Navigate to your WhatsApp Business Account

2. **Access Webhook Settings:**
   - Go to **Settings** → **WhatsApp** → **Configuration**
   - Scroll to **Webhook** section
   - Click **Edit** or **Set up webhook**

3. **Configure Webhook:**
   - **Callback URL:** `https://your-domain.com/webhooks/whatsapp`
   - **Verify Token:** Enter the same value as `WHATSAPP_VERIFY_TOKEN` in your `.env`
   - Click **Verify and Save**

4. **Subscribe to Webhook Fields:**
   Select the events you want to receive:
   - ✅ `messages` - Incoming messages from users
   - ✅ `message_status` - Delivery status updates (sent, delivered, read, failed)

5. **Test Webhook:**
   - Meta will send a test verification request
   - Check your server logs to confirm verification succeeded
   - You should see: `✅ WhatsApp webhook verified successfully`

### For Development (Local Testing with ngrok):

1. **Install ngrok:**
   ```bash
   # macOS
   brew install ngrok
   
   # Or download from https://ngrok.com/download
   ```

2. **Start your backend server:**
   ```bash
   cd wexp-backend
   npm run dev
   # Server runs on http://localhost:3000
   ```

3. **Create ngrok tunnel:**
   ```bash
   ngrok http 3000
   ```

4. **Copy the HTTPS URL:**
   ```
   Forwarding: https://abc123xyz.ngrok.io -> http://localhost:3000
   ```

5. **Use ngrok URL in Meta:**
   - **Callback URL:** `https://abc123xyz.ngrok.io/webhooks/whatsapp`
   - **Verify Token:** Your `WHATSAPP_VERIFY_TOKEN` from `.env`
   - Click **Verify and Save**

6. **Keep ngrok running:**
   - Keep the ngrok terminal open while testing
   - Note: Free ngrok URLs change on restart. For stable testing, consider ngrok paid plan.

## Step 4: Verify Webhook is Working

### Check Server Logs

When Meta verifies your webhook, you should see:

```
🔐 WhatsApp Webhook Verification Request
✅ WhatsApp webhook verified successfully - Challenge returned
```

### Test Incoming Messages

1. Send a message to your WhatsApp Business number from a regular WhatsApp account
2. Check your server logs for:

```
📥 WhatsApp Webhook Event Received
💬 Received WhatsApp Incoming Message
```

### Test Status Updates

When you send a message, you'll receive status updates:

```
📊 WhatsApp Message Status Update
✅ Message sent to WhatsApp servers
📬 Message delivered to recipient
👁️ Message read by recipient
```

## Step 5: Webhook Event Structure

### Incoming Message Event

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "1234567890",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "messages": [
              {
                "from": "255712345678",
                "id": "wamid.xxx",
                "timestamp": "1234567890",
                "type": "text",
                "text": {
                  "body": "Hello!"
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

### Status Update Event

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "statuses": [
              {
                "id": "wamid.xxx",
                "status": "delivered",
                "timestamp": "1234567890",
                "recipient_id": "255712345678"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

## Step 6: Customize Webhook Handlers

### Handle Incoming Messages

Edit `src/services/whatsapp.service.ts` → `handleIncomingMessage()`:

```typescript
private async handleIncomingMessage(message: WhatsAppMessage): Promise<void> {
    // Your custom logic here:
    // - Store in database
    // - Process RSVP responses
    // - Auto-reply
    // - Notify event organizers
}
```

### Handle Status Updates

Edit `src/services/whatsapp.service.ts` → `handleMessageStatus()`:

```typescript
private async handleMessageStatus(status: WhatsAppStatus): Promise<void> {
    // Your custom logic here:
    // - Update message status in database
    // - Track delivery rates
    // - Handle failed messages
    // - Send notifications
}
```

## Troubleshooting

### Webhook Verification Fails

**Symptoms:** Meta shows "Webhook verification failed"

**Solutions:**
1. Check `WHATSAPP_VERIFY_TOKEN` matches exactly in `.env` and Meta dashboard
2. Ensure webhook endpoint is accessible (not behind firewall)
3. Check server logs for verification attempts
4. Verify endpoint returns challenge value, not JSON

### No Webhook Events Received

**Symptoms:** Messages sent but no webhook events in logs

**Solutions:**
1. Verify webhook is subscribed to correct fields in Meta dashboard
2. Check webhook URL is correct and accessible
3. Ensure server is running and endpoint is reachable
4. Check Meta dashboard for webhook delivery status
5. Verify phone number is connected to your WhatsApp Business Account

### Webhook Events but Processing Fails

**Symptoms:** Events received but errors in logs

**Solutions:**
1. Check server logs for detailed error messages
2. Ensure database connections are working
3. Verify all required services are running
4. Check for rate limiting issues

## Security Best Practices

1. **Verify Token:** Use a strong, random verify token
2. **HTTPS Only:** Always use HTTPS for webhook URLs (required by Meta)
3. **Validate Requests:** Consider adding request signature validation (optional but recommended)
4. **Rate Limiting:** Implement rate limiting to prevent abuse
5. **Logging:** Log all webhook events for debugging and auditing

## Testing Webhook Locally

### Using ngrok (Recommended for Development)

```bash
# Terminal 1: Start backend
cd wexp-backend
npm run dev

# Terminal 2: Start ngrok
ngrok http 3000

# Use the ngrok HTTPS URL in Meta dashboard
```

### Using Postman to Test Verification

```http
GET https://your-domain.com/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=your_verify_token
```

Expected response: `test123` (the challenge value)

## Webhook URL Examples

- **Production:** `https://api.yourapp.com/webhooks/whatsapp`
- **Development (ngrok):** `https://abc123.ngrok.io/webhooks/whatsapp`
- **Local (not recommended):** `http://localhost:3000/webhooks/whatsapp` (won't work - Meta requires HTTPS)

## Next Steps

1. ✅ Set up webhook in Meta Business Suite
2. ✅ Test webhook verification
3. ✅ Send test messages and verify events are received
4. ✅ Implement custom business logic in webhook handlers
5. ✅ Set up database storage for messages and statuses
6. ✅ Add error handling and retry logic

## Additional Resources

- [Meta WhatsApp Business API Webhooks Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
- [Meta Business Suite](https://business.facebook.com/)
- [ngrok Documentation](https://ngrok.com/docs)

## Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test webhook verification endpoint manually
4. Check Meta dashboard for webhook delivery status

