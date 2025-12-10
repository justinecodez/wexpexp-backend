# WhatsApp Webhook Configuration

## Your ngrok URL

Based on your ngrok URL, here's how to configure it:

### Complete Webhook URL

If your ngrok URL is: `https://cloudy-shoshana-unobligatory.ngrok.io`

Then your webhook callback URL should be:
```
https://cloudy-shoshana-unobligatory.ngrok.io/webhooks/whatsapp
```

## Meta Business Suite Configuration

### Step 1: Access Webhook Settings

1. Go to: https://business.facebook.com/
2. Navigate to: **Settings** → **WhatsApp** → **Configuration**
3. Scroll to **Webhook** section
4. Click **Edit** or **Set up webhook**

### Step 2: Enter Webhook Details

**Callback URL:**
```
https://cloudy-shoshana-unobligatory.ngrok.io/webhooks/whatsapp
```

**Verify Token:**
```
a9f396107eaff1d638396c0510147aaef235e1631303ea85c4e7a5c6fea87c2d
```

### Step 3: Subscribe to Webhook Fields

Check these boxes:
- ✅ `messages` - Receive incoming messages
- ✅ `message_status` - Receive delivery status updates

### Step 4: Verify

Click **Verify and Save**

## Important Notes

1. **Keep ngrok running** - The tunnel must stay active while testing
2. **Free ngrok URLs change** - If you restart ngrok, you'll get a new URL and need to update Meta
3. **Backend must be running** - Your server on port 3001 must be running
4. **Check server logs** - You should see verification attempts in your backend logs

## Testing

After configuration, check your backend logs for:
```
🔐 WhatsApp Webhook Verification Request
✅ WhatsApp webhook verified successfully - Challenge returned
```

## Troubleshooting

If verification fails:
1. Make sure backend is running: `npm run dev` in `wexp-backend`
2. Make sure ngrok is running: `ngrok http 3001`
3. Test endpoint manually:
   ```bash
   curl "https://cloudy-shoshana-unobligatory.ngrok.io/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=a9f396107eaff1d638396c0510147aaef235e1631303ea85c4e7a5c6fea87c2d"
   ```
   Should return: `test123`

