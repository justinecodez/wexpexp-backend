# WhatsApp Chat Setup Guide

## Overview
A complete chat functionality has been added to your dashboard, allowing you to send and receive WhatsApp messages directly from the admin panel.

## What Was Added

### Backend Components

1. **Database Entities**
   - `Conversation` - Stores chat conversations with contacts
   - `Message` - Stores individual messages (inbound/outbound) with status tracking

2. **Services**
   - `ConversationService` - Handles conversation and message operations
   - Updated `WhatsAppService` - Now stores incoming messages and updates status

3. **API Endpoints**
   - `GET /api/conversations` - Get all conversations
   - `GET /api/conversations/:id/messages` - Get messages for a conversation
   - `POST /api/conversations/send` - Send a message
   - `POST /api/conversations/:id/read` - Mark conversation as read

### Frontend Components

1. **WhatsAppChat Component** - Full-featured chat interface
   - Conversation list with search
   - Real-time message polling
   - Message status indicators
   - Unread message badges

2. **Dashboard Integration** - Added "WhatsApp Chat" tab

## Setup Instructions

### Step 1: Restart Backend Server

The new database tables need to be created. Restart your backend server:

```bash
cd wexp-backend
npm run dev
```

TypeORM will automatically create the `conversations` and `messages` tables when the server starts (if `synchronize: true` is enabled in development).

### Step 2: Verify Tables Created

You can verify the tables were created by checking the database:

```bash
sqlite3 wexp-backend/database.sqlite ".tables" | grep -E "conversations|messages"
```

You should see:
- `conversations`
- `messages`

### Step 3: Test the Chat

1. Open your dashboard
2. Click on the "WhatsApp Chat" tab in the sidebar
3. The chat interface should load (may be empty if no conversations yet)

## How It Works

### Incoming Messages
1. Customer sends WhatsApp message → Webhook receives it
2. Message is stored in database → Linked to user via invitation lookup
3. Message appears in chat UI automatically

### Outgoing Messages
1. You type a message in the chat UI
2. Message is sent via WhatsApp API
3. Message is stored in database
4. Status updates (sent/delivered/read) come via webhook

### Real-time Updates
- The chat polls for new messages every 3 seconds when a conversation is open
- Message status updates automatically when webhooks are received

## Troubleshooting

### Error: 500 Internal Server Error

**Cause**: Database tables don't exist yet

**Solution**: 
1. Restart your backend server to create the tables
2. Check backend logs for any database errors
3. Verify entities are properly registered in `src/entities/index.ts`

### Error: Empty Chat Page

**Cause**: No conversations exist yet

**Solution**: This is normal! The chat will be empty until:
- A customer sends a WhatsApp message to your business number
- You send a message to a customer from the Communications page

### Messages Not Appearing

**Check**:
1. Webhook is properly configured in Meta Business Suite
2. Webhook URL is accessible (ngrok running if local)
3. Backend logs show incoming webhook events
4. Phone numbers match between invitations and messages

## Next Steps

1. **Test with a real message**: Send a WhatsApp message to your business number
2. **Reply from dashboard**: Use the chat interface to respond
3. **Monitor webhooks**: Check backend logs to see incoming messages being stored

## API Usage Examples

### Get Conversations
```bash
curl -X GET http://localhost:3001/api/conversations \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Send Message
```bash
curl -X POST http://localhost:3001/api/conversations/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "255123456789",
    "content": "Hello from dashboard!"
  }'
```

### Get Messages
```bash
curl -X GET http://localhost:3001/api/conversations/CONVERSATION_ID/messages \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Notes

- Conversations are automatically linked to users via phone number lookup in invitations
- If no invitation is found, the system uses a fallback user ID
- Message status (sent/delivered/read) is updated automatically via webhooks
- The chat interface polls for new messages every 3 seconds

