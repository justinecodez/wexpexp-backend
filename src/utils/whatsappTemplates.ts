/**
 * WhatsApp Template Definitions and Rendering Utilities
 * 
 * This file centralizes the template text for WhatsApp messages to ensure
 * consistency between Meta's template manager, backend storage, and frontend display.
 */

export interface WhatsAppTemplate {
    name: string;
    language: string;
    body: string;
    header?: string;
    footer?: string;
}

export const WHATSAPP_TEMPLATES: Record<string, Record<string, WhatsAppTemplate>> = {
    wedding_invite: {
        en: {
            name: 'wedding_invite',
            language: 'en',
            body: 'Dear {{guestname}},\n\nThe family of Mr. and Mrs. {{hostname}} would like to invite you to the wedding of their beloved children {{bridename}} and {{groomname}},\n\nTaking place on {{eventdate}} at {{venue}}, starting at {{starttime}} until {{endtime}}.\n\nWe look forward to celebrating with you.',
        },
        sw: {
            name: 'wedding_invite',
            language: 'sw',
            body: 'Mpendwa {{guestname}},\n\nFamilia ya Bwana na Bi {{hostname}} inapenda kukualika kwenye harusi ya mtoto wao mpendwa {{bridename}} na {{groomname}},\n\nItakayofanyika tarehe {{eventdate}} mahali {{venue}}, kuanzia saa {{starttime}} hadi {{endtime}}.\n\nTunatarajia kusherehekea pamoja nawe.',
        }
    },
    wedding_invitation_with_image: {
        en: {
            name: 'wedding_invitation_with_image',
            language: 'en',
            body: 'Dear {{guestname}},\n\nThe family of Mr. and Mrs. {{hostname}} would like to invite you to the wedding of their beloved children {{bridename}} and {{groomname}},\n\nTaking place on {{eventdate}} at {{venue}}, starting at {{starttime}} until {{endtime}}.\n\nWe look forward to celebrating with you.',
        },
        sw: {
            name: 'wedding_invitation_with_image',
            language: 'sw',
            body: 'Mpendwa {{guestname}},\n\nFamilia ya Bwana na Bi {{hostname}} inapenda kukualika kwenye harusi ya mtoto wao mpendwa {{bridename}} na {{groomname}},\n\nItakayofanyika tarehe {{eventdate}} mahali {{venue}}, kuanzia saa {{starttime}} hadi {{endtime}}.\n\nTunatarajia kusherehekea pamoja nawe.',
        }
    },
    wexp_marketing_campaign: {
        en: {
            name: 'wexp_marketing_campaign',
            language: 'en',
            body: 'Get elegant digital cards for Weddings, Send-offs, and Meetings. Make your event modern and unique:\n\nIt’s now Digital! 📲\n\nQR-Code cards and Scanning at the door.\n\nSend invitations easily via WhatsApp & SMS.\n\nWEXP – We go further',
        },
        sw: {
            name: 'wexp_marketing_campaign',
            language: 'sw',
            body: 'Pata kadi maridadi za kidijitali kwa Harusi, Send-off, na Mikutano. Fanya tukio lako kuwa la kisasa na la kipekee:\n\nSasa ni Kidijitali! 📲\n\nKadi za QR-Code na Scanning mlangoni.\n\nTuma mialiko kwa urahisi kupitia WhatsApp & SMS.\n\nWEXP – Tunakwenda mbali zaidi',
        }
    }
};

/**
 * Renders a WhatsApp template message by substituting parameters
 * 
 * @param templateName The name of the template in Meta manager
 * @param languageCode Language code (en, sw, etc.)
 * @param components The components array sent to/received from WhatsApp API
 * @returns The fully rendered message string
 */
export function renderWhatsAppTemplate(
    templateName: string,
    languageCode: string,
    components: any[]
): string {
    const lang = languageCode.startsWith('sw') ? 'sw' : 'en';
    const template = WHATSAPP_TEMPLATES[templateName]?.[lang];

    if (!template) {
        return `[Template: ${templateName}]`;
    }

    let renderedBody = template.body;

    // Extract parameters from components
    const bodyComponent = components.find(c => c.type === 'body');
    if (bodyComponent && bodyComponent.parameters) {
        bodyComponent.parameters.forEach((param: any, index: number) => {
            const paramName = param.parameter_name;
            const value = param.text || param.date_time?.fallback_value || '';

            if (paramName) {
                // If parameter has a name, use it
                renderedBody = renderedBody.replace(new RegExp(`{{${paramName}}}`, 'g'), value);
            } else {
                // Positional replacement (for templates that don't use named parameters in API call)
                // Note: Index is 0-based in array, but usually 1-indexed in template strings if using positional {{1}}
                renderedBody = renderedBody.replace(new RegExp(`{{${index + 1}}}`, 'g'), value);
            }
        });
    }

    // Extract header attachment if present
    const headerComponent = components.find(c => c.type === 'header');
    if (headerComponent && headerComponent.parameters?.[0]) {
        const param = headerComponent.parameters[0];
        const mediaType = param.type; // image, video, document
        const mediaUrl = param[mediaType]?.link;

        if (mediaUrl) {
            renderedBody = `[${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} Attachment: ${mediaUrl}]\n\n${renderedBody}`;
        }
    }

    // Clean up any remaining placeholders
    renderedBody = renderedBody.replace(/{{[a-zA-Z0-9_]+}}/g, '...');

    return renderedBody;
}
