import { Router } from 'express';
import multer from 'multer';
import campaignController from '../controllers/campaignController';
import { authenticate } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication
// TEMPORARILY DISABLED FOR TESTING - UNCOMMENT BEFORE PRODUCTION!
router.use(authenticate);

/**
 * @route   POST /api/campaigns
 * @desc    Create a new campaign
 * @access  Private (Admin)
 */
router.post('/', (req, res) => campaignController.createCampaign(req, res));

/**
 * @route   GET /api/campaigns
 * @desc    Get all campaigns for the authenticated user
 * @access  Private
 */
router.get('/', (req, res) => campaignController.getCampaigns(req, res));

/**
 * @route   GET /api/campaigns/:id
 * @desc    Get campaign by ID
 * @access  Private
 */
router.get('/:id', (req, res) => campaignController.getCampaignById(req, res));

/**
 * @route   PUT /api/campaigns/:id
 * @desc    Update campaign
 * @access  Private
 */
router.put('/:id', (req, res) => campaignController.updateCampaign(req, res));

/**
 * @route   DELETE /api/campaigns/:id
 * @desc    Delete campaign
 * @access  Private
 */
router.delete('/:id', (req, res) => campaignController.deleteCampaign(req, res));

/**
 * @route   POST /api/campaigns/:id/recipients/add
 * @desc    Add manual recipient to campaign
 * @access  Private
 */
router.post('/:id/recipients/add', (req, res) => campaignController.addRecipient(req, res));

/**
 * @route   POST /api/campaigns/:id/recipients/import
 * @desc    Import recipients from Excel file
 * @access  Private
 */
router.post('/:id/recipients/import', upload.single('file'), (req, res) =>
    campaignController.importRecipients(req, res)
);

/**
 * @route   PUT /api/campaigns/:id/recipients/:recipientId
 * @desc    Update individual recipient
 * @access  Private
 */
router.put('/:id/recipients/:recipientId', (req, res) =>
    campaignController.updateRecipient(req, res)
);

/**
 * @route   DELETE /api/campaigns/:id/recipients/:recipientId
 * @desc    Remove recipient from campaign
 * @access  Private
 */
router.delete('/:id/recipients/:recipientId', (req, res) =>
    campaignController.removeRecipient(req, res)
);

/**
 * @route   POST /api/campaigns/:id/send
 * @desc    Send campaign to all recipients
 * @access  Private (Admin)
 */
router.post('/:id/send', (req, res) => campaignController.sendCampaign(req, res));

/**
 * @route   POST /api/campaigns/attachments
 * @desc    Upload campaign attachment
 * @access  Private
 */
router.post('/attachments', upload.single('file'), (req, res) =>
    campaignController.uploadAttachment(req, res)
);

/**
 * @route   GET /api/campaigns/:id/stats
 * @desc    Get campaign statistics
 * @access  Private
 */
router.get('/:id/stats', (req, res) => campaignController.getCampaignStats(req, res));

export default router;
