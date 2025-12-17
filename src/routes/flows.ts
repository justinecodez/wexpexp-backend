import { Router } from 'express';
import flowsController from '../controllers/flowsController';

const router = Router();

/**
 * @route   POST /api/flows/rsvp
 * @desc    WhatsApp RSVP Flow endpoint
 * @access  Public (validated by signature)
 */
router.post('/rsvp', (req, res) => flowsController.handleRSVPFlow(req, res));

export default router;
