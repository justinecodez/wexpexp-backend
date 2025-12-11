# WhatsApp Template: Wedding Invitation with Image

## Template Name
`wedding_invitation_with_image`

## Template Text (For Meta Business Suite Submission)

**Template with Named Variables** (lowercase as required by WhatsApp):

```
Dear {{guestname}},

The family of Mr. and Mrs. {{hostname}} would like to invite you to the wedding of their beloved {{bridename}} and {{groomname}},

Which will take place on {{eventdate}} at {{venue}}, from {{starttime}} to {{endtime}}.

We look forward to celebrating with you.
```

## Variable Mapping to Database Fields

| Template Variable | Database Field | Entity Property | Description | Example Value |
|-------------------|----------------|-----------------|-------------|---------------|
| {{guestname}} | `guest_name` | `invitation.guestName` | Guest Name | "John Doe" |
| {{hostname}} | `user.firstName + lastName` | `event.user.firstName + lastName` | Host Names (Mr. and Mrs.) | "Justine and Sarah" |
| {{bridename}} | Custom/Event field | `event.brideName` or custom | First Person Getting Married | "Sarah" |
| {{groomname}} | Custom/Event field | `event.groomName` or custom | Second Person Getting Married | "Justine" |
| {{eventdate}} | `event_date` | `event.eventDate` | Event Date | "January 25, 2024" |
| {{venue}} | `venue_name` + `venue_address` | `event.venueName` + `event.venueAddress` | Location/Venue | "Kilimanjaro Hotel, Dar es Salaam" |
| {{starttime}} | `start_time` | `event.startTime` | Start Time | "10:00 AM" |
| {{endtime}} | `end_time` | `event.endTime` | End Time | "6:00 PM" |

## Template Configuration

**Template Name**: `wedding_invitation_with_image`

**Category**: `UTILITY`

**Language**: `en_US` (English)

**Header**: Image (invitation card)

**Body**: Use the template text above with named variables

**Buttons**:
- Button 1: `✅ Confirm Attendance` (QUICK_REPLY) - Optional
- Button 2: `❌ Cannot Attend` (QUICK_REPLY) - Optional
- Button 3: `📍 View Location` (URL) - Optional

## Example Data for Template Submission

When submitting to Meta Business Suite, provide this example showing how the template will look:

```
Dear John Doe,

The family of Mr. and Mrs. Justine and Sarah would like to invite you to the wedding of their beloved Sarah and Justine,

Which will take place on January 25, 2024 at Kilimanjaro Hotel, Dar es Salaam, from 10:00 AM to 6:00 PM.

We look forward to celebrating with you.
```

## Using in Code (Automatic Integration)

The template is **automatically used** when sending WhatsApp messages with card attachments from the Communications page. No manual code needed!

### How It Works

1. **Frontend**: When sending WhatsApp messages with cards, the system automatically:
   - Includes `invitationId` and `eventId` in the request
   - Sets `useTemplate: true` when a card is present

2. **Backend**: The communication service:
   - Detects `mediaUrl` + `invitationId`/`eventId`
   - Fetches invitation and event data from database
   - Uses `sendWeddingInvitationWithImage()` helper function
   - Automatically formats dates and times
   - Combines venue fields
   - Builds host name from user fields

### Manual Usage (If Needed)

```typescript
// Fetch invitation and event from database
const invitation = await invitationRepository.findOne({
  where: { id: invitationId },
  relations: ['event', 'event.user']
});

const event = invitation.event;

// Send using template
await whatsAppService.sendWeddingInvitationWithImage(
  invitation.guestPhone,
  {
    guestName: invitation.guestName,
    cardUrl: invitation.cardUrl
  },
  {
    eventDate: event.eventDate,
    startTime: event.startTime,
    endTime: event.endTime,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    user: event.user,
    brideName: event.brideName,
    groomName: event.groomName,
  },
  invitation.cardUrl,
  `https://yourdomain.com/rsvp/${invitation.qrCode}`,
  'en_US'
);
```

### Automatic Field Mapping & Formatting

The function automatically handles:
- ✅ **Date Formatting**: Converts `event.eventDate` to readable format (e.g., "January 25, 2024")
- ✅ **Time Formatting**: Converts 24h time to 12h format with AM/PM (e.g., "10:00 AM", "6:00 PM")
- ✅ **Venue Combination**: Combines `event.venueName` + `event.venueAddress` for {{venue}}
- ✅ **Host Name Building**: Combines `event.user.firstName` + `event.user.lastName` with " and " for {{hostname}}
- ✅ **Card URL**: Uses `invitation.cardUrl` or provided `mediaUrl` for header image
- ✅ **RSVP Link**: Automatically generates RSVP link from `invitation.qrCode` if available
- ✅ **Fallbacks**: Provides defaults if fields are missing (e.g., "Family" if no user name, "Bride"/"Groom" if no names)

## Integration in Communication Flow

The template is integrated into the communication flow:

1. **Communications Page**: When user selects guests and sends WhatsApp messages with cards
2. **Automatic Detection**: System detects card presence (`mediaUrl`) and invitation data
3. **Template Usage**: Automatically uses `wedding_invitation_with_image` template instead of regular image message
4. **Fallback**: If template fails or data not found, falls back to regular image message

## Notes

1. **Lowercase Variables**: WhatsApp requires lowercase variable names (e.g., `{{guestname}}` not `{{guestName}}`)

2. **Language Code**: Use `en_US` for English template

3. **Automatic Formatting**: The helper function automatically:
   - Formats dates to readable format (e.g., "January 25, 2024")
   - Converts times to 12h format with AM/PM
   - Combines venue fields
   - Builds host name from user fields

4. **Missing Fields**: If `brideName` or `groomName` are not in your Event entity, you can:
   - Add them as optional fields to the Event entity
   - Or parse them from the event title
   - Or use default values ("Bride" and "Groom")

5. **Template Approval**: Make sure to submit the template to Meta Business Suite with lowercase variables as shown above.

## Template Submission Checklist

- [ ] Template name: `wedding_invitation_with_image`
- [ ] Category: `UTILITY`
- [ ] Language: `en_US`
- [ ] Header: Image (invitation card)
- [ ] Body: Use exact template text with lowercase variables
- [ ] Variables: {{guestname}}, {{hostname}}, {{bridename}}, {{groomname}}, {{eventdate}}, {{venue}}, {{starttime}}, {{endtime}}
- [ ] Buttons: Optional RSVP buttons
- [ ] Example data provided
- [ ] Template submitted and approved

