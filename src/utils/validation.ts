import { z } from 'zod';

// Simple phone schema without validation
const phoneSchema = z.string().min(1, 'Phone number cannot be empty');

// Authentication Schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  phone: phoneSchema.optional(),
  companyName: z.string().optional(),
  businessType: z.enum(['INDIVIDUAL', 'COMPANY', 'ORGANIZATION']).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
});

// User Profile Schemas
export const updateProfileSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters').optional(),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').optional(),
  phone: phoneSchema.optional(),
  companyName: z.string().optional(),
  businessType: z.enum(['INDIVIDUAL', 'COMPANY', 'ORGANIZATION']).optional(),
});

// Event Schemas
export const createEventSchema = z.object({
  title: z.string().min(3, 'Event title must be at least 3 characters'),
  description: z.string().optional(),
  eventType: z.enum([
    'WEDDING',
    'BIRTHDAY',
    'CORPORATE',
    'CONFERENCE',
    'PARTY',
    'CULTURAL',
    'RELIGIOUS',
    'OTHER',
  ]),
  eventDate: z.string().refine(date => !isNaN(Date.parse(date)), {
    message: 'Invalid date format',
  }),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
  endTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)')
    .optional(),
  venueName: z.string().optional(),
  venueAddress: z.string().optional(),
  venueCity: z
    .enum([
      'DAR_ES_SALAAM',
      'ARUSHA',
      'ZANZIBAR',
      'MWANZA',
      'DODOMA',
      'TANGA',
      'MOROGORO',
      'MBEYA',
      'IRINGA',
      'KILIMANJARO',
    ])
    .optional(),
  maxGuests: z.number().int().min(1, 'Must allow at least 1 guest'),
  budget: z.number().positive().optional(),
  isPublic: z.boolean().optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const eventFilterSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  eventType: z
    .enum([
      'WEDDING',
      'BIRTHDAY',
      'CORPORATE',
      'CONFERENCE',
      'PARTY',
      'CULTURAL',
      'RELIGIOUS',
      'OTHER',
    ])
    .optional(),
  venueCity: z
    .enum([
      'DAR_ES_SALAAM',
      'ARUSHA',
      'ZANZIBAR',
      'MWANZA',
      'DODOMA',
      'TANGA',
      'MOROGORO',
      'MBEYA',
      'IRINGA',
      'KILIMANJARO',
    ])
    .optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

// Invitation Schemas
const baseInvitationSchema = z.object({
  eventId: z.string().cuid('Invalid event ID'),
  guestName: z.string().min(2, 'Guest name must be at least 2 characters'),
  guestEmail: z.string().email('Invalid email format').optional(),
  guestPhone: phoneSchema.optional(),
  invitationMethod: z.enum(['EMAIL', 'SMS', 'WHATSAPP']),
  specialRequirements: z.string().optional(),
});

export const createInvitationSchema = baseInvitationSchema.refine(
  data => {
    if (data.invitationMethod === 'EMAIL' && !data.guestEmail) {
      return false;
    }
    if (
      (data.invitationMethod === 'SMS' || data.invitationMethod === 'WHATSAPP') &&
      !data.guestPhone
    ) {
      return false;
    }
    return true;
  },
  {
    message: 'Email is required for email invitations, phone is required for SMS/WhatsApp',
  }
);

const bulkInvitationItemSchema = baseInvitationSchema.omit({ eventId: true }).refine(
  data => {
    if (data.invitationMethod === 'EMAIL' && !data.guestEmail) {
      return false;
    }
    if (
      (data.invitationMethod === 'SMS' || data.invitationMethod === 'WHATSAPP') &&
      !data.guestPhone
    ) {
      return false;
    }
    return true;
  },
  {
    message: 'Email is required for email invitations, phone is required for SMS/WhatsApp',
  }
);

export const bulkInvitationSchema = z.object({
  eventId: z.string().cuid('Invalid event ID'),
  invitations: z.array(bulkInvitationItemSchema).min(1, 'At least one invitation is required'),
});

export const rsvpSchema = z.object({
  rsvpStatus: z.enum(['ACCEPTED', 'DECLINED']),
  plusOneCount: z.number().int().min(0).optional(),
  specialRequirements: z.string().optional(),
});

// Service Schemas
export const serviceFilterSchema = z.object({
  location: z
    .enum([
      'DAR_ES_SALAAM',
      'ARUSHA',
      'ZANZIBAR',
      'MWANZA',
      'DODOMA',
      'TANGA',
      'MOROGORO',
      'MBEYA',
      'IRINGA',
      'KILIMANJARO',
    ])
    .optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  category: z.string().optional(),
  availability: z.boolean().optional(),
  search: z.string().optional(),
});

export const bookingSchema = z.object({
  serviceType: z.enum(['TOUR', 'VEHICLE', 'ACCOMMODATION', 'VENUE', 'DECORATION']),
  serviceId: z.string().cuid('Invalid service ID'),
  bookingDate: z.string().refine(date => !isNaN(Date.parse(date)), {
    message: 'Invalid booking date format',
  }),
  startDate: z
    .string()
    .refine(date => !isNaN(Date.parse(date)), {
      message: 'Invalid start date format',
    })
    .optional(),
  endDate: z
    .string()
    .refine(date => !isNaN(Date.parse(date)), {
      message: 'Invalid end date format',
    })
    .optional(),
  guests: z.number().int().positive().optional(),
  specialRequests: z.string().optional(),
});

// Communication Schemas
export const emailSchema = z
  .object({
    to: z.union([z.string().email(), z.array(z.string().email())]),
    subject: z.string().min(1, 'Subject is required'),
    html: z.string().optional(),
    text: z.string().optional(),
  })
  .refine(data => data.html || data.text, {
    message: 'Either HTML or text content is required',
  });

export const smsSchema = z.object({
  to: z.union([phoneSchema, z.array(phoneSchema)]),
  message: z.string().min(1, 'Message is required').max(160, 'SMS message too long'),
  scheduled: z
    .string()
    .refine(date => !isNaN(Date.parse(date)), {
      message: 'Invalid scheduled date format',
    })
    .optional(),
});

export const whatsappSchema = z.object({
  to: z.union([phoneSchema, z.array(phoneSchema)]),
  message: z.string().min(1, 'Message is required'),
  type: z.enum(['text', 'template']).optional(),
  templateName: z.string().optional(),
  templateParams: z.record(z.any()).optional(),
});

// Car Import Schemas
export const carImportInquirySchema = z.object({
  vehicleMake: z.string().min(1, 'Vehicle make is required'),
  vehicleModel: z.string().min(1, 'Vehicle model is required'),
  vehicleYear: z
    .number()
    .int()
    .min(1990)
    .max(new Date().getFullYear() + 1),
  originCountry: z.string().min(1, 'Origin country is required'),
  estimatedValue: z.number().positive().optional(),
  currency: z.string().default('USD'),
  inquiryType: z.enum(['Quote', 'Process', 'Documentation']),
  currentLocation: z.string().optional(),
  timeframe: z.string().optional(),
  additionalDetails: z.string().optional(),
});

// Template Schemas
export const createTemplateSchema = z.object({
  eventId: z.string().cuid('Invalid event ID'),
  name: z.string().min(1, 'Template name is required').max(100),
  settings: z.object({
    includeInvitations: z.boolean().optional(),
    includeECards: z.boolean().optional(),
    includeBudget: z.boolean().optional(),
    includeVenue: z.boolean().optional(),
  }).optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial();

// Budget Schemas
export const budgetItemSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  amount: z.number().positive('Amount must be positive'),
  dueDate: z.string().refine(date => !isNaN(Date.parse(date)), {
    message: 'Invalid date format',
  }).optional(),
  status: z.enum(['PLANNED', 'PAID', 'CANCELLED']),
  paymentMethod: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

// Calendar Schemas
export const calendarConnectionSchema = z.object({
  provider: z.enum(['GOOGLE', 'OUTLOOK', 'ICAL']),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenExpiry: z.string().optional(),
});

export const calendarEventSchema = z.object({
  eventId: z.string().cuid('Invalid event ID'),
  title: z.string().min(1, 'Event title is required'),
  description: z.string().optional(),
  startDate: z.string().refine(date => !isNaN(Date.parse(date)), {
    message: 'Invalid start date format',
  }),
  endDate: z.string().refine(date => !isNaN(Date.parse(date)), {
    message: 'Invalid end date format',
  }).optional(),
  location: z.string().optional(),
  attendees: z.array(z.object({
    email: z.string().email('Invalid email format'),
    name: z.string().optional(),
  })).optional(),
});

// Budget Schemas
export const createBudgetSchema = z.object({
  eventId: z.string().cuid('Invalid event ID').optional(),
  name: z.string().min(1, 'Budget name is required'),
  totalBudget: z.number().positive('Total budget must be positive'),
  currency: z.string().default('TZS'),
  categories: z.record(z.any()),
  notes: z.string().optional(),
});

export const updateBudgetSchema = createBudgetSchema.partial();

// Pagination Schema
export const paginationSchema = z.object({
  page: z
    .string()
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0, {
      message: 'Page must be positive',
    })
    .optional(),
  limit: z
    .string()
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0 && val <= 100, {
      message: 'Limit must be between 1 and 100',
    })
    .optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const idParamSchema = z.object({
  id: z.string().cuid('Invalid ID format'),
});

// File Upload Schema
export const fileUploadSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  mimetype: z.string(),
  size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
});

// Landing Page Schema
export const landingPageContentSchema = z.object({
  sectionType: z.string().min(1, 'Section type is required'),
  contentData: z.record(z.any()),
  isActive: z.boolean().optional(),
});

export type LoginSchema = z.infer<typeof loginSchema>;
export type RegisterSchema = z.infer<typeof registerSchema>;
export type CreateEventSchema = z.infer<typeof createEventSchema>;
export type CreateInvitationSchema = z.infer<typeof createInvitationSchema>;
export type BookingSchema = z.infer<typeof bookingSchema>;
export type EmailSchema = z.infer<typeof emailSchema>;
export type SMSSchema = z.infer<typeof smsSchema>;
export type WhatsAppSchema = z.infer<typeof whatsappSchema>;

// Draft related schemas
export const draftUpdateSchema = createEventSchema.partial().extend({
  status: z.enum(['DRAFT']).optional(),
  lastAutosaveAt: z.date().optional(),
});

export const publishDraftSchema = z.object({
  draftId: z.string().uuid('Invalid draft ID'),
});

export type DraftUpdateSchema = z.infer<typeof draftUpdateSchema>;
export type PublishDraftSchema = z.infer<typeof publishDraftSchema>;
