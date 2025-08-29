import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/validation';
import communicationService from '../services/communicationService';
import database from '../config/database';
import { MessageLog } from '../entities/MessageLog';
import { Repository } from 'typeorm';
import logger from '../config/logger';

const router = Router();

// Simple connection test endpoint
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Backend API is running successfully!',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      endpoints: {
        auth: '/api/auth',
        events: '/api/events',
        invitations: '/api/invitations',
        tours: '/api/tours',
        vehicles: '/api/vehicles',
      }
    });
  } catch (error) {
    logger.error('Test endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test email endpoint
const testEmailSchema = z.object({
  to: z.string().email('Invalid email format'),
  subject: z.string().min(1, 'Subject is required').optional(),
  text: z.string().min(1, 'Message is required').optional(),
});

router.post('/email', validateQuery(testEmailSchema), async (req, res) => {
  try {
    const {
      to,
      subject = 'Test Email from WEXP API',
      text = 'This is a test email to verify SMTP configuration.',
    } = req.body;

    const result = await communicationService.sendEmail({
      to,
      subject,
      text,
      html: `<p>${text}</p><br><p><em>Sent from WEXP API Email Test</em></p>`,
    });

    logger.info(`Test email sent to ${to}`, { result });

    res.json({
      success: true,
      message: 'Test email sent successfully',
      data: result,
    });
  } catch (error) {
    logger.error('Test email failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send test email',
    });
  }
});

// Get email statistics
router.get('/email-stats', async (req, res) => {
  try {
    const messageLogRepository = database.getRepository(MessageLog) as Repository<MessageLog>;

    // Get total counts
    const totalSent = await messageLogRepository.count({
      where: { method: 'EMAIL' as any, status: 'SENT' as any },
    });

    const totalFailed = await messageLogRepository.count({
      where: { method: 'EMAIL' as any, status: 'FAILED' as any },
    });

    // Get last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const last24hSent = await messageLogRepository
      .createQueryBuilder('log')
      .where('log.method = :method', { method: 'EMAIL' })
      .andWhere('log.status = :status', { status: 'SENT' })
      .andWhere('log.createdAt >= :yesterday', { yesterday })
      .getCount();

    const last24hFailed = await messageLogRepository
      .createQueryBuilder('log')
      .where('log.method = :method', { method: 'EMAIL' })
      .andWhere('log.status = :status', { status: 'FAILED' })
      .andWhere('log.createdAt >= :yesterday', { yesterday })
      .getCount();

    // Get recent failures
    const recentFailures = await messageLogRepository.find({
      where: { method: 'EMAIL' as any, status: 'FAILED' as any },
      order: { createdAt: 'DESC' },
      take: 5,
      select: ['recipient', 'errorMessage', 'createdAt', 'subject'],
    });

    // Get recent successes
    const recentSuccesses = await messageLogRepository.find({
      where: { method: 'EMAIL' as any, status: 'SENT' as any },
      order: { createdAt: 'DESC' },
      take: 5,
      select: ['recipient', 'deliveredAt', 'subject'],
    });

    res.json({
      success: true,
      data: {
        totals: {
          sent: totalSent,
          failed: totalFailed,
          total: totalSent + totalFailed,
        },
        last24h: {
          sent: last24hSent,
          failed: last24hFailed,
        },
        recent_failures: recentFailures.map(f => ({
          recipient: f.recipient,
          subject: f.subject,
          error: f.errorMessage,
          timestamp: f.createdAt,
        })),
        recent_successes: recentSuccesses.map(s => ({
          recipient: s.recipient,
          subject: s.subject,
          delivered_at: s.deliveredAt,
        })),
      },
    });
  } catch (error) {
    logger.error('Failed to get email stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get email statistics',
    });
  }
});

// Get recent email logs
router.get('/email-logs', async (req, res) => {
  try {
    const { limit = '10' } = req.query;
    const messageLogRepository = database.getRepository(MessageLog) as Repository<MessageLog>;

    const logs = await messageLogRepository.find({
      where: { method: 'EMAIL' as any },
      order: { createdAt: 'DESC' },
      take: parseInt(limit as string, 10),
      select: ['id', 'recipient', 'subject', 'status', 'createdAt', 'deliveredAt', 'errorMessage'],
    });

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    logger.error('Failed to get email logs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get email logs',
    });
  }
});

export default router;
