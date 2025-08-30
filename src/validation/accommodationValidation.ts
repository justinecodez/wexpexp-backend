import { z } from 'zod';
import { AccommodationType } from '../entities/enums';

export const accommodationValidation = {
  create: z.object({
    body: z.object({
      name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
      description: z.string().min(1, 'Description is required'),
      type: z.nativeEnum(AccommodationType),
      location: z.string().min(1, 'Location is required'),
      address: z.string().min(1, 'Address is required'),
      capacity: z.number().int().min(1, 'Capacity must be at least 1'),
      pricePerNight: z.number().min(0, 'Price must be positive'),
      amenities: z.array(z.string()).optional(),
      images: z.array(z.string()).optional(),
      contactInfo: z.object({
        phone: z.string().optional(),
        email: z.string().email().optional()
      }).optional()
    })
  }),

  update: z.object({
    body: z.object({
      name: z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
      description: z.string().min(1, 'Description is required').optional(),
      type: z.nativeEnum(AccommodationType).optional(),
      location: z.string().min(1, 'Location is required').optional(),
      address: z.string().min(1, 'Address is required').optional(),
      capacity: z.number().int().min(1, 'Capacity must be at least 1').optional(),
      pricePerNight: z.number().min(0, 'Price must be positive').optional(),
      amenities: z.array(z.string()).optional(),
      images: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
      contactInfo: z.object({
        phone: z.string().optional(),
        email: z.string().email().optional()
      }).optional()
    })
  }),

  createBooking: z.object({
    body: z.object({
      accommodationId: z.string().uuid('Invalid accommodation ID'),
      startDate: z.string().refine(
        (date) => !isNaN(Date.parse(date)),
        'Invalid start date format'
      ),
      endDate: z.string().refine(
        (date) => !isNaN(Date.parse(date)),
        'Invalid end date format'
      ),
      guests: z.number().int().min(1, 'At least 1 guest required'),
      specialRequests: z.string().optional()
    }).refine(
      (data) => new Date(data.startDate) < new Date(data.endDate),
      {
        message: 'End date must be after start date',
        path: ['endDate']
      }
    ).refine(
      (data) => new Date(data.startDate) >= new Date(),
      {
        message: 'Start date must be in the future',
        path: ['startDate']
      }
    )
  }),

  updateBooking: z.object({
    body: z.object({
      guests: z.number().int().min(1, 'At least 1 guest required').optional(),
      specialRequests: z.string().optional(),
      status: z.enum(['CANCELLED']).optional()
    })
  }),

  search: z.object({
    query: z.object({
      location: z.string().optional(),
      checkIn: z.string().refine(
        (date) => !isNaN(Date.parse(date)),
        'Invalid check-in date format'
      ).optional(),
      checkOut: z.string().refine(
        (date) => !isNaN(Date.parse(date)),
        'Invalid check-out date format'
      ).optional(),
      guests: z.string().transform(val => parseInt(val)).refine(
        val => val > 0,
        'Guests must be a positive number'
      ).optional(),
      type: z.nativeEnum(AccommodationType).optional(),
      minPrice: z.string().transform(val => parseFloat(val)).refine(
        val => val >= 0,
        'Minimum price must be non-negative'
      ).optional(),
      maxPrice: z.string().transform(val => parseFloat(val)).refine(
        val => val >= 0,
        'Maximum price must be non-negative'
      ).optional(),
      amenities: z.string().optional()
    })
  }),

  availability: z.object({
    body: z.object({
      dates: z.array(z.object({
        date: z.string().refine(
          (date) => !isNaN(Date.parse(date)),
          'Invalid date format'
        ),
        available: z.boolean(),
        price: z.number().min(0, 'Price must be non-negative').optional()
      }))
    })
  })
};
