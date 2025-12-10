# WhatsApp Template Request Guide: Event Invitation with Card & RSVP Button

This guide will help you create and request approval for a WhatsApp Business API template that includes:
- **Card Image** (invitation card attachment)
- **Text Message** (personalized invitation text)
- **RSVP Button** (Confirm Attendance button)

## Step 1: Access Meta Business Suite

1. Go to [Meta Business Suite](https://business.facebook.com/)
2. Navigate to **WhatsApp** → **Message Templates**
3. Click **"Create Template"** or **"New Template"**

## Step 2: Template Configuration

### Basic Information

- **Template Name**: `event_invitation_with_rsvp`
  - Must be lowercase, use underscores, no spaces
  - Must be unique in your account
  
- **Category**: Select **"UTILITY"** or **"MARKETING"**
  - **UTILITY**: For transactional messages (recommended for invitations)
  - **MARKETING**: For promotional messages
  
- **Language**: Select your primary language (e.g., `English (US)` or `Swahili`)

### Template Content Structure

#### Option 1: Media Template (Recommended)

**Template Type**: `MEDIA`

**Header Section**:
- **Type**: `IMAGE`
- **Media**: Upload your invitation card image
- **Caption**: Leave empty (we'll use body text instead)

**Body Section** (Choose one of these simpler options):

**Option A - Minimal (2 variables)**:
```
Hello {{1}}! You're invited to {{2}}. We hope you can join us!
```
**Variables**:
1. `{{1}}` - Guest Name
2. `{{2}}` - Event Name (can include date/location in the name if you want)

**Option B - Simple (3 variables)**:
```
Hello {{1}}! You're invited to {{2}} on {{3}}. We hope you can join us!
```
**Variables**:
1. `{{1}}` - Guest Name
2. `{{2}}` - Event Name
3. `{{3}}` - Event Date (you can include location here too, e.g., "Dec 25, 2024 at Main Hall")

**Option C - Standard (4 variables)**:
```
Hello {{1}}! You're invited to {{2}} on {{3}} at {{4}}. We hope you can join us!
```
**Variables**:
1. `{{1}}` - Guest Name
2. `{{2}}` - Event Name
3. `{{3}}` - Event Date
4. `{{4}}` - Event Location

**Option D - Full (5 variables)** - Only if you need maximum flexibility:
```
Hello {{1}}! You're invited to {{2}} on {{3}} at {{4}}. {{5}}
```
**Variables**:
1. `{{1}}` - Guest Name
2. `{{2}}` - Event Name
3. `{{3}}` - Event Date
4. `{{4}}` - Event Location
5. `{{5}}` - Additional Message (optional)

**Footer** (Optional):
```
For questions, contact us at {{1}}
```
- `{{1}}` - Contact Phone/Email

**Buttons**:
- **Button Type**: `QUICK_REPLY` (recommended) or `URL`
- **Button 1**: 
  - Text: `✅ Confirm Attendance`
  - Type: `QUICK_REPLY`
  - Payload: `CONFIRM_ATTENDANCE`
- **Button 2** (Optional):
  - Text: `❌ Cannot Attend`
  - Type: `QUICK_REPLY`
  - Payload: `DECLINE_ATTENDANCE`
- **Button 3** (Optional):
  - Text: `📍 View Location`
  - Type: `URL`
  - URL: `{{1}}` (Google Maps link)

#### Option 2: Interactive Template with Call-to-Action

**Template Type**: `INTERACTIVE`

**Header**: Image (your invitation card)

**Body**: Same as above

**Buttons**:
- **Button Type**: `BUTTONS`
- **Button 1**: 
  - Type: `QUICK_REPLY`
  - Text: `✅ Confirm Attendance`
- **Button 2**:
  - Type: `QUICK_REPLY`
  - Text: `❌ Decline`
- **Button 3** (Optional):
  - Type: `URL`
  - Text: `View Event Details`
  - URL: `{{1}}` (Event page URL)

## Step 3: Template JSON Structure

Here's the exact JSON structure you'll need to submit via API (or use in Business Suite):

```json
{
  "name": "event_invitation_with_rsvp",
  "language": "en_US",
  "category": "UTILITY",
  "components": [
    {
      "type": "HEADER",
      "format": "IMAGE",
      "example": {
        "header_handle": ["https://example.com/invitation-card.jpg"]
      }
    },
    {
      "type": "BODY",
      "text": "Hello {{1}}! You're invited to {{2}} on {{3}} at {{4}}. We hope you can join us! {{5}}",
      "example": {
        "body_text": [
          [
            "John Doe",
            "Wedding Celebration",
            "December 25, 2024",
            "123 Main Street, Dar es Salaam",
            "Looking forward to celebrating with you!"
          ]
        ]
      }
    },
    {
      "type": "FOOTER",
      "text": "For questions, contact us at {{1}}"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "QUICK_REPLY",
          "text": "✅ Confirm Attendance"
        },
        {
          "type": "QUICK_REPLY",
          "text": "❌ Cannot Attend"
        },
        {
          "type": "URL",
          "text": "📍 View Location",
          "url": "https://maps.google.com/?q={{1}}"
        }
      ]
    }
  ]
}
```

## Step 4: Template Approval Requirements

### Content Guidelines

1. **No Promotional Language**: Avoid words like "free", "discount", "limited time"
2. **Clear Purpose**: Template must have a clear, legitimate business purpose
3. **No Spam**: Template should not be used for unsolicited messages
4. **Compliance**: Must comply with WhatsApp Business Policy

### Media Requirements

- **Image Format**: JPG, PNG
- **Image Size**: Max 5MB
- **Image Dimensions**: Recommended 800x800px or 16:9 ratio
- **Image Quality**: High quality, clear text if text is in image

### Button Requirements

- **Quick Reply Buttons**: 
  - Max 3 buttons
  - Each button: Max 20 characters
  - Must be clear and actionable
  
- **URL Buttons**:
  - Must use HTTPS
  - Must be a valid, accessible URL
  - Can use template variables

## Step 5: Submit for Approval

1. **Review Template**: Double-check all content, variables, and buttons
2. **Submit**: Click "Submit for Review"
3. **Wait**: Approval typically takes 24-48 hours
4. **Status**: Check status in Message Templates section

## Step 6: Using the Template in Your Code

Once approved, use it like this:

```typescript
// In your communicationService.ts or whatsapp.service.ts

await whatsAppService.sendTemplateMessage(
  phoneNumber,
  'event_invitation_with_rsvp', // Template name
  'en_US', // Language code
  [
    // Header component (image URL)
    {
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: {
            link: 'https://yourdomain.com/cards/event/guest.png'
          }
        }
      ]
    },
    // Body component (text variables)
    {
      type: 'body',
      parameters: [
        { type: 'text', text: 'John Doe' }, // {{1}} - Guest Name
        { type: 'text', text: 'Wedding Celebration' }, // {{2}} - Event Name
        { type: 'text', text: 'December 25, 2024' }, // {{3}} - Event Date
        { type: 'text', text: '123 Main Street' }, // {{4}} - Location
        { type: 'text', text: 'Looking forward to celebrating!' } // {{5}} - Additional message
      ]
    },
    // Footer component
    {
      type: 'footer',
      parameters: [
        { type: 'text', text: '+255123456789' } // Contact info
      ]
    }
  ]
);
```

## Step 7: Handling Button Responses

When users click the buttons, you'll receive webhook events:

```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "255123456789",
          "type": "button",
          "button": {
            "text": "✅ Confirm Attendance",
            "payload": "CONFIRM_ATTENDANCE"
          }
        }]
      }
    }]
  }]
}
```

Handle these in your webhook handler to update RSVP status.

## Alternative: Using URL Button for RSVP

If you prefer a URL button instead of quick reply:

```json
{
  "type": "URL",
  "text": "Confirm Attendance",
  "url": "https://yourdomain.com/rsvp/{{1}}?token={{2}}"
}
```

Where:
- `{{1}}` - Event ID
- `{{2}}` - RSVP Token

## Template Name Suggestions

- `event_invitation_with_rsvp` (Recommended)
- `invitation_card_rsvp`
- `event_rsvp_confirmation`
- `wedding_invitation_rsvp`

## Important Notes

1. **Template Names**: Once created, template names cannot be changed
2. **Variables**: All variables must be used in the example
3. **Buttons**: Quick reply buttons send responses back to your webhook
4. **Media**: Image must be publicly accessible via HTTPS
5. **Approval**: Rejected templates can be resubmitted after fixing issues

## Troubleshooting

### Template Rejected?

Common reasons:
- Promotional language detected
- Missing example values
- Invalid image URL
- Button text too long
- Non-compliant content

### Template Not Sending?

- Check template name matches exactly
- Verify all required variables are provided
- Ensure template is approved (status: "APPROVED")
- Check language code matches template language

## Next Steps After Approval

1. Update your `sendTemplateMessage` function to use the new template
2. Create a helper function to format template parameters
3. Update your frontend to show template option when 24-hour window expires
4. Handle button responses in your webhook handler

## Recommended: Simple 3-Variable Template

**Template Body Text:**
```
Hello {{1}}! You're invited to {{2}} on {{3}}. We hope you can join us!
```

**Usage (Simplified):**
```typescript
// Combine date and location into one field to reduce complexity
const eventDetails = `${eventDate} at ${eventLocation}`;
// Example: "December 25, 2024 at 123 Main Street, Dar es Salaam"

await whatsAppService.sendEventInvitationWithRSVP(
  phoneNumber,
  guestName,        // {{1}}
  eventName,        // {{2}}
  eventDetails,     // {{3}} - Date + Location combined
  cardImageUrl,
  rsvpLink,
  contactInfo
);
```

This reduces complexity from 5 variables to just 3, making it much easier to use!

---

**Need Help?** 
- [WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates)
- [Template Guidelines](https://developers.facebook.com/docs/whatsapp/message-templates/guidelines)
- [Meta Business Support](https://business.facebook.com/help)

