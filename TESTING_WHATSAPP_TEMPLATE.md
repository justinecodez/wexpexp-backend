# Testing WhatsApp Template: wedding_invitation_with_image

## Prerequisites

1. ✅ Template `wedding_invitation_with_image` is approved in Meta Business Suite
2. ✅ Backend server is running
3. ✅ Frontend is running
4. ✅ WhatsApp Business API credentials are configured
5. ✅ You have at least one event with invitations

## Step-by-Step Testing Guide

### Step 1: Prepare Your Test Data

1. **Create or Select an Event**
   - Go to your dashboard
   - Create a new event OR select an existing event
   - Make sure the event has:
     - Event date
     - Start time and end time
     - Venue name and address
     - User (host) information (firstName, lastName)

2. **Add Guests/Invitations**
   - Add at least one guest with:
     - Guest name
     - Phone number (WhatsApp number)
     - Make sure the phone number is in international format (e.g., `255757714834`)

3. **Generate Personalized Cards** (Optional but Recommended)
   - Go to Communications page
   - Select your event
   - Click "Generate Custom Card" to create personalized cards
   - Wait for card generation to complete
   - Cards will be automatically attached when sending

### Step 2: Test Template via Communications Page

#### Option A: Test with Generated Cards

1. **Navigate to Communications Page**
   - Go to Dashboard → Communications tab

2. **Select Event and Guests**
   - Select your event from the dropdown
   - Select one or more guests (with phone numbers)
   - Make sure guests have phone numbers

3. **Enable Card Attachment**
   - Click "Include Card Attachment" button (should be highlighted/active)
   - OR generate new cards first using "Generate Custom Card"

4. **Select WhatsApp Channel**
   - Select "WhatsApp" as the communication channel

5. **Send Message**
   - Click "Send Message" button
   - The system will automatically:
     - Detect card presence
     - Fetch invitation and event data
     - Use `wedding_invitation_with_image` template
     - Fill all template variables automatically

#### Option B: Test with Existing Cards

1. **Use Existing Cards**
   - If guests already have cards (from previous generation)
   - Select guests with existing `cardUrl`
   - Click "Include Card Attachment"
   - Send via WhatsApp

### Step 3: Verify Template Usage

#### Check Backend Logs

Look for these log messages in your backend console:

```
📧 Using wedding_invitation_with_image template for 255757714834
{
  invitationId: '...',
  eventId: '...',
  guestName: 'John Doe'
}
```

#### Check WhatsApp API Request

You should see in backend logs:

```
📤 WhatsApp API Request - Send Template Message
{
  templateName: 'wedding_invitation_with_image',
  languageCode: 'en_US',
  components: [
    {
      type: 'header',
      parameters: [{ type: 'image', image: { link: '...' } }]
    },
    {
      type: 'body',
      parameters: [
        { type: 'text', text: 'John Doe' },        // {{guestname}}
        { type: 'text', text: 'Justine and Sarah' }, // {{hostname}}
        { type: 'text', text: 'Sarah' },          // {{bridename}}
        { type: 'text', text: 'Justine' },        // {{groomname}}
        { type: 'text', text: 'January 25, 2024' }, // {{eventdate}}
        { type: 'text', text: 'Kilimanjaro Hotel, Dar es Salaam' }, // {{venue}}
        { type: 'text', text: '10:00 AM' },       // {{starttime}}
        { type: 'text', text: '6:00 PM' }         // {{endtime}}
      ]
    }
  ]
}
```

#### Check Frontend Console

In browser DevTools console, you should see:

```
🚀 Sending WhatsApp Payload: {
  to: "255757714834",
  message: "...",
  mediaUrl: "http://localhost:3001/uploads/cards/...",
  invitationId: "...",
  eventId: "...",
  useTemplate: true
}
```

### Step 4: Verify Message Delivery

1. **Check Recipient's WhatsApp**
   - Open WhatsApp on the recipient's phone
   - You should receive a template message with:
     - **Header**: Your personalized card image
     - **Body**: Formatted invitation text with all variables filled:
       ```
       Dear John Doe,
       
       The family of Mr. and Mrs. Justine and Sarah would like to invite you 
       to the wedding of their beloved Sarah and Justine,
       
       Which will take place on January 25, 2024 at Kilimanjaro Hotel, 
       Dar es Salaam, from 10:00 AM to 6:00 PM.
       
       We look forward to celebrating with you.
       ```
     - **Buttons**: RSVP buttons (if configured in template)

2. **Verify Template Variables**
   - ✅ Guest name is correct
   - ✅ Host names are correct
   - ✅ Bride and groom names are correct (or defaults if not set)
   - ✅ Event date is formatted correctly
   - ✅ Venue is combined correctly
   - ✅ Times are formatted with AM/PM
   - ✅ Card image appears in header

### Step 5: Troubleshooting

#### Issue: Template Not Being Used

**Symptoms:**
- Regular image message sent instead of template
- Backend logs show "falling back to regular image message"

**Possible Causes:**
1. **Missing Invitation/Event Data**
   - Check: `invitationId` or `eventId` is being passed
   - Solution: Ensure guest selection includes invitation data

2. **Card Not Present**
   - Check: `mediaUrl` is included in payload
   - Solution: Enable "Include Card Attachment" or generate cards first

3. **Database Query Failing**
   - Check: Backend logs for database errors
   - Solution: Verify invitation and event exist in database

**Debug Steps:**
```javascript
// Check in browser console
console.log('Recipient data:', recipient);
// Should show: { id, name, phone, mediaUrl, invitation: {...} }
```

#### Issue: Template Variables Not Filled

**Symptoms:**
- Template sent but variables show as `{{guestname}}` instead of actual values

**Possible Causes:**
1. **Wrong Variable Names**
   - Check: Template uses lowercase: `{{guestname}}` not `{{guestName}}`
   - Solution: Verify template in Meta Business Suite

2. **Parameter Order Mismatch**
   - Check: Parameters array order matches template variable order
   - Solution: Verify `sendWeddingInvitationWithImage` function

**Debug Steps:**
- Check backend logs for the `components` array
- Verify parameter order matches template variable order

#### Issue: Template Rejected by WhatsApp

**Symptoms:**
- Error: "Template not found" or "Template not approved"

**Possible Causes:**
1. **Template Name Mismatch**
   - Check: Template name is exactly `wedding_invitation_with_image`
   - Solution: Verify in Meta Business Suite

2. **Template Not Approved**
   - Check: Template status in Meta Business Suite
   - Solution: Wait for approval or check template status

3. **Language Code Mismatch**
   - Check: Template language is `en_US`
   - Solution: Verify template language in Meta Business Suite

### Step 6: Test Different Scenarios

#### Scenario 1: Multiple Guests
- Select multiple guests
- Send to all
- Verify each receives personalized template with their name

#### Scenario 2: Missing Optional Fields
- Test with event missing `brideName`/`groomName`
- Should use defaults: "Bride" and "Groom"

#### Scenario 3: Missing Venue
- Test with event missing venue
- Should use default: "Event Venue"

#### Scenario 4: Without Card
- Send WhatsApp without card attachment
- Should send regular text message (not template)

#### Scenario 5: Template Fallback
- Intentionally break invitation lookup
- Should fallback to regular image message
- Check logs for fallback message

## Expected Results

### ✅ Success Indicators

1. **Backend Logs:**
   ```
   📧 Using wedding_invitation_with_image template for 255757714834
   ✅ WhatsApp API Response - Template Message Success
   ```

2. **Frontend:**
   - Success alert: "Message sent successfully"
   - No errors in console

3. **WhatsApp:**
   - Template message received
   - Card image in header
   - All variables filled correctly
   - Message formatted properly

### ❌ Failure Indicators

1. **Backend Logs:**
   ```
   ⚠️ Could not find invitation/event data, falling back to regular image message
   ❌ Error using template for ..., falling back to regular image
   ```

2. **Frontend:**
   - Error alert
   - Console errors

3. **WhatsApp:**
   - Regular image message instead of template
   - Variables not filled
   - Template not found error

## Quick Test Checklist

- [ ] Event created with all required fields
- [ ] Guest added with phone number
- [ ] Card generated or existing card available
- [ ] "Include Card Attachment" enabled
- [ ] WhatsApp channel selected
- [ ] Message sent successfully
- [ ] Backend logs show template usage
- [ ] Template message received on WhatsApp
- [ ] All variables filled correctly
- [ ] Card image appears in header

## Next Steps After Testing

1. **Monitor Delivery Status**
   - Check webhook logs for delivery confirmations
   - Verify message status updates

2. **Test RSVP Buttons**
   - If RSVP buttons configured, test clicking them
   - Verify RSVP link works

3. **Scale Testing**
   - Test with multiple recipients
   - Monitor rate limiting
   - Check performance

4. **Production Deployment**
   - Update environment variables
   - Test in production environment
   - Monitor error rates

## Support

If you encounter issues:
1. Check backend logs for detailed error messages
2. Verify template approval status in Meta Business Suite
3. Check WhatsApp API response for specific error codes
4. Review database to ensure invitation/event data exists

