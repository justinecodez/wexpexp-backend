import { z } from 'zod';

// E-card validation
export const createECardSchema = z.object({
  eventId: z.string().min(1),
  templateId: z.string().optional(),
  customText: z.string().optional()
});

export const updateECardSchema = z.object({
  customText: z.string().optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional()
});

// Booking validation  
export const createVenueBookingSchema = z.object({
  serviceType: z.literal('VENUE'),
  serviceId: z.string().min(1),
  bookingDate: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  guests: z.number().min(1).optional()
});

export const createDecorationBookingSchema = z.object({
  serviceType: z.literal('DECORATION'),
  serviceId: z.string().min(1),
  bookingDate: z.string(),
  startDate: z.string(),
  specialRequests: z.string().optional()
});

// Car import validation
export const createCarImportInquirySchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().min(1990),
  country: z.string().min(1)
});

export const updateCarImportInquirySchema = z.object({
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.number().min(1990).optional(),
  country: z.string().min(1).optional()
});

// Insurance validation
export const createInsurancePolicySchema = z.object({
  planId: z.string().min(1),
  eventId: z.string().min(1).optional(),
  coverage: z.number().min(1)
});

export const updateInsurancePolicySchema = z.object({
  coverage: z.number().min(1).optional(),
  beneficiaries: z.array(z.string()).optional()
});

// Landing page validation
export const updateLandingContentSchema = z.object({
  section: z.string().min(1),
  content: z.record(z.any())
});

// Communication validation
export const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1)
});

export const sendSMSSchema = z.object({
  to: z.string().min(1),
  message: z.string().min(1)
});

export const sendBulkMessageSchema = z.object({
  eventId: z.string().optional(),
  recipients: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email().optional(),
      phone: z.string().optional()
    })
  ),
  channels: z.array(z.enum(['email', 'sms', 'whatsapp'])),
  subject: z.string().optional(),
  message: z.string().optional(),
  template: z.string().optional(),
  scheduledFor: z.string().optional()
});
