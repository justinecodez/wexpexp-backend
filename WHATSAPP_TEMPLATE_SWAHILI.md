# WhatsApp Template: Swahili Wedding Invitation

## Template Text (Using Named Variables - Matches Database Fields)

**Template with Named Variables** (Plug-and-Play with Database):

```
Mpendwa *{{guestname}}*,

Familia ya Bwana na Bi {{hostname}} inapenda kukualika kwenye harusi ya mtoto wao mpendwa {{bridename}} na {{groomname}},

Itakayofanyika tarehe {{eventdate}} mahali {{venue}}, kuanzia saa {{starttime}} hadi {{endtime}}.

Tunatarajia kusherehekea pamoja nawe.
```

## Variable Mapping to Database Fields

| Template Variable | Database Field | Entity Property | Description | Example Value |
|-------------------|----------------|-----------------|-------------|---------------|
| {{guestname}} | `guest_name` | `invitation.guestName` | Guest Name | "John Doe" |
| {{hostname}} | `user.firstName + lastName` | `event.user.firstName + lastName` | Host Names (Bwana na Bi) | "Justine na Sarah" |
| {{bridename}} | Custom/Event field | `event.brideName` or custom | First Person Getting Married | "Sarah" |
| {{groomname}} | Custom/Event field | `event.groomName` or custom | Second Person Getting Married | "Justine" |
| {{eventdate}} | `event_date` | `event.eventDate` | Event Date | "25 Desemba, 2024" |
| {{venue}} | `venue_name` + `venue_address` | `event.venueName` + `event.venueAddress` | Location/Venue | "Kilimanjaro Hotel, Dar es Salaam" |
| {{starttime}} | `start_time` | `event.startTime` | Start Time | "10:00 asubuhi" |
| {{endtime}} | `end_time` | `event.endTime` | End Time | "6:00 jioni" |

## Template Configuration

**Template Name**: `swahili_wedding_invitation`

**Category**: `UTILITY`

**Language**: `sw` (Swahili) or `en_US` (if English is your default)

**Header**: Image (invitation card)

**Body**: Use the template text above with named variables

**Buttons**:
- Button 1: `✅ Thibitisha Ushiriki` (QUICK_REPLY)
- Button 2: `❌ Siwezi Kufika` (QUICK_REPLY) - Optional
- Button 3: `📍 Angalia Eneo` (URL) - Optional

## Example Data for Template Submission

When submitting to Meta Business Suite, provide this example showing how the template will look:

```
Mpendwa *John Doe*,

Familia ya Bwana na Bi Justine na Sarah inapenda kukualika kwenye harusi ya mtoto wao mpendwa Sarah na Justine,

Itakayofanyika tarehe 25 Desemba, 2024 mahali Kilimanjaro Hotel, Dar es Salaam, kuanzia saa 10:00 asubuhi hadi 6:00 jioni.

Tunatarajia kusherehekea pamoja nawe.
```

**Important**: WhatsApp template variables must be **lowercase** (e.g., `{{guestname}}` not `{{guestName}}`).

**Note**: If your WhatsApp API requires numbered variables instead of named ones, the template text should be:

```
Mpendwa *{{1}}*,

Familia ya Bwana na Bi {{2}} inapenda kukualika kwenye harusi ya mtoto wao mpendwa {{3}} na {{4}},

Itakayofanyika tarehe {{5}} mahali {{6}}, kuanzia saa {{7}} hadi {{8}}.

Tunatarajia kusherehekea pamoja nawe.
```

The helper function will automatically map your database fields to the correct variable positions.

## Using in Code (Plug-and-Play with Database)

The helper function accepts invitation and event objects directly from your database - **no manual mapping needed!**

### Simple Usage - Direct from Database

```typescript
// Fetch invitation with event and user relations
const invitation = await invitationRepository.findOne({
  where: { id: invitationId },
  relations: ['event', 'event.user']
});

// Send directly - all fields automatically mapped from database!
await whatsAppService.sendSwahiliWeddingInvitation(
  invitation.guestPhone,                    // Phone number
  invitation,                                // Uses: guestName, cardUrl
  invitation.event,                          // Uses: eventDate, startTime, endTime, venueName, venueAddress, user, brideName, groomName
  invitation.cardUrl || defaultCardUrl,     // Card image
  `https://yourdomain.com/rsvp/${invitation.qrCode}`, // RSVP link
  'sw'                                       // Language code
);
```

### Batch Sending Example

```typescript
// Send to all invitations for an event
const invitations = await invitationRepository.find({
  where: { eventId: eventId },
  relations: ['event', 'event.user']
});

for (const invitation of invitations) {
  await whatsAppService.sendSwahiliWeddingInvitation(
    invitation.guestPhone,
    invitation,
    invitation.event,
    invitation.cardUrl,
    `https://yourdomain.com/rsvp/${invitation.qrCode}`
  );
}
```

### Automatic Field Mapping & Formatting

The function automatically handles:
- ✅ **Date Formatting**: Converts `event.eventDate` to Swahili format (e.g., "25 Desemba, 2024")
- ✅ **Time Formatting**: Adds Swahili suffixes (e.g., "10:00 asubuhi", "6:00 jioni", "8:00 mchana")
- ✅ **Venue Combination**: Combines `event.venueName` + `event.venueAddress` for {{venue}}
- ✅ **Host Name Building**: Combines `event.user.firstName` + `event.user.lastName` with " na " for {{hostName}}
- ✅ **Card URL**: Uses `invitation.cardUrl` if available
- ✅ **Fallbacks**: Provides defaults if fields are missing (e.g., "Familia" if no user name, "Bibi"/"Bwana" if no bride/groom names)

## Database Field Mapping

The template variables directly map to your database fields:

```typescript
// From Invitation entity
invitation.guestName     → {{guestname}}
invitation.cardUrl       → Used for header image

// From Event entity  
event.eventDate          → {{eventdate}} (auto-formatted to Swahili)
event.startTime          → {{starttime}} (auto-formatted with Swahili suffix)
event.endTime            → {{endtime}} (auto-formatted with Swahili suffix)
event.venueName          → Combined with venueAddress for {{venue}}
event.venueAddress       → Combined with venueName for {{venue}}

// From User entity (via event.user)
event.user.firstName      → Combined with lastName for {{hostname}}
event.user.lastName       → Combined with firstName for {{hostname}}

// Optional fields (add to Event entity if needed)
event.brideName          → {{bridename}}
event.groomName          → {{groomname}}
```

## Notes

1. **Named Variables**: If your WhatsApp API supports named variables, use them as shown. If not, you'll need to use numbered variables ({{1}}-{{8}}) and the helper function will map them correctly.

2. **Language Code**: Use `sw` for Swahili. If your template is approved in English, use `en_US`.

3. **Automatic Formatting**: The helper function automatically:
   - Formats dates to Swahili format (e.g., "25 Desemba, 2024")
   - Adds Swahili time suffixes (asubuhi/mchana/jioni)
   - Combines venue fields
   - Builds host name from user fields

4. **Missing Fields**: If `brideName` or `groomName` are not in your Event entity, you can:
   - Add them as optional fields to the Event entity
   - Or parse them from the event title
   - Or use default values ("Bibi" and "Bwana")

