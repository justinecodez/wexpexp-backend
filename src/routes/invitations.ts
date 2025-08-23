import { Router } from 'express';
import { z } from 'zod';
import invitationController from '../controllers/invitationController';
import { authenticate, verifyEventOwnership } from '../middleware/auth';
import { emailLimiter, smsLimiter } from '../middleware/rateLimit';
import { validateBody, validateQuery, validateParams } from '../middleware/validation';
import { uploadCSV } from '../utils/fileUpload';
import {
  createInvitationSchema,
  bulkInvitationSchema,
  rsvpSchema,
  paginationSchema,
  idParamSchema,
} from '../utils/validation';

const router = Router();

/**
 * @route   POST /api/invitations
 * @desc    Create a single invitation
 * @access  Private
 */
router.post('/',
  authenticate,
  emailLimiter,
  validateBody(createInvitationSchema),
  invitationController.createInvitation
);

/**
 * @route   POST /api/invitations/bulk
 * @desc    Create bulk invitations
 * @access  Private
 */
router.post('/bulk',
  authenticate,
  emailLimiter,
  validateBody(bulkInvitationSchema),
  invitationController.createBulkInvitations
);

/**
 * @route   GET /api/invitations/event/:eventId
 * @desc    Get invitations for an event
 * @access  Private (event owner)
 */
router.get('/event/:eventId',
  authenticate,
  validateParams(idParamSchema.extend({ eventId: idParamSchema.shape.id })),
  verifyEventOwnership,
  validateQuery(paginationSchema.extend({
    rsvpStatus: z.enum(['PENDING', 'ACCEPTED', 'DECLINED']).optional(),
    deliveryStatus: z.enum(['PENDING', 'SENT', 'DELIVERED', 'FAILED']).optional(),
    invitationMethod: z.enum(['EMAIL', 'SMS', 'WHATSAPP']).optional(),
    search: z.string().optional(),
  })),
  invitationController.getEventInvitations
);

/**
 * @route   PUT /api/invitations/:id/rsvp
 * @desc    Update RSVP status (public endpoint)
 * @access  Public
 */
router.put('/:id/rsvp',
  validateParams(idParamSchema),
  validateBody(rsvpSchema),
  invitationController.updateRSVP
);

/**
 * @route   GET /api/invitations/qr/:qrCode
 * @desc    Get invitation details by QR code (for public RSVP page)
 * @access  Public
 */
router.get('/qr/:qrCode',
  invitationController.getInvitationByQR
);

/**
 * @route   POST /api/invitations/qr/:qrCode/checkin
 * @desc    Check-in guest using QR code
 * @access  Public (but validates QR code)
 */
router.post('/qr/:qrCode/checkin',
  invitationController.checkInGuest
);

/**
 * @route   POST /api/invitations/:id/resend
 * @desc    Resend invitation
 * @access  Private
 */
router.post('/:id/resend',
  authenticate,
  validateParams(idParamSchema),
  smsLimiter,
  invitationController.resendInvitation
);

/**
 * @route   DELETE /api/invitations/:id
 * @desc    Delete invitation
 * @access  Private
 */
router.delete('/:id',
  authenticate,
  validateParams(idParamSchema),
  invitationController.deleteInvitation
);

/**
 * @route   POST /api/invitations/import-csv
 * @desc    Import guests from CSV file
 * @access  Private
 */
router.post('/import-csv',
  authenticate,
  uploadCSV.single('file'),
  invitationController.importGuestsFromCSV
);

/**
 * @route   GET /api/invitations/export-csv/:eventId
 * @desc    Export guest list to CSV
 * @access  Private (event owner)
 */
router.get('/export-csv/:eventId',
  authenticate,
  validateParams(idParamSchema.extend({ eventId: idParamSchema.shape.id })),
  verifyEventOwnership,
  invitationController.exportGuestListToCSV
);

/**
 * @route   GET /api/invitations/stats/:eventId
 * @desc    Get invitation statistics for an event
 * @access  Private (event owner)
 */
router.get('/stats/:eventId',
  authenticate,
  validateParams(idParamSchema.extend({ eventId: idParamSchema.shape.id })),
  verifyEventOwnership,
  invitationController.getInvitationStats
);

/**
 * @route   POST /api/invitations/reminders/:eventId
 * @desc    Send reminders to pending guests
 * @access  Private (event owner)
 */
router.post('/reminders/:eventId',
  authenticate,
  validateParams(idParamSchema.extend({ eventId: idParamSchema.shape.id })),
  verifyEventOwnership,
  smsLimiter,
  invitationController.sendReminders
);

export default router;
