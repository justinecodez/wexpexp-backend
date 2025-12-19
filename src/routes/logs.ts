import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../config/logger';

const router = Router();

/**
 * Real-time log viewer for WhatsApp webhook debugging
 * Protected endpoint - requires authentication
 */

// Simple middleware to protect log endpoints
const requireAuth = (req: Request, res: Response, next: Function) => {
    const authToken = req.headers['x-admin-token'] || req.query.token;
    const validToken = process.env.ADMIN_LOG_TOKEN || 'wexp_admin_logs_2024';

    if (authToken === validToken) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

/**
 * GET /api/logs/whatsapp?lines=100&token=YOUR_TOKEN
 * View recent WhatsApp webhook logs
 */
router.get('/whatsapp', requireAuth, (req: Request, res: Response) => {
    try {
        const lines = parseInt(req.query.lines as string) || 100;
        const logPath = path.join(__dirname, '../../logs/application.log');

        if (!fs.existsSync(logPath)) {
            return res.status(404).json({
                error: 'Log file not found',
                path: logPath
            });
        }

        const logContent = fs.readFileSync(logPath, 'utf-8');
        const allLines = logContent.split('\n');

        // Filter for WhatsApp-related logs
        const whatsappLogs = allLines
            .filter(line =>
                line.includes('WhatsApp') ||
                line.includes('webhook') ||
                line.includes('📥') ||
                line.includes('📋') ||
                line.includes('🔄')
            )
            .slice(-lines); // Get last N lines

        res.json({
            success: true,
            count: whatsappLogs.length,
            logs: whatsappLogs,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        logger.error('Error reading WhatsApp logs:', error);
        res.status(500).json({
            error: 'Failed to read logs',
            message: error.message
        });
    }
});

/**
 * GET /api/logs/whatsapp/stream?token=YOUR_TOKEN
 * Server-Sent Events stream for real-time logs
 */
router.get('/whatsapp/stream', requireAuth, (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const logPath = path.join(__dirname, '../../logs/application.log');
    let lastSize = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    // Poll for new log entries every 2 seconds
    const interval = setInterval(() => {
        try {
            if (!fs.existsSync(logPath)) return;

            const currentSize = fs.statSync(logPath).size;

            if (currentSize > lastSize) {
                const stream = fs.createReadStream(logPath, {
                    start: lastSize,
                    end: currentSize
                });

                let buffer = '';
                stream.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line in buffer

                    lines.forEach(line => {
                        if (line.includes('WhatsApp') || line.includes('webhook')) {
                            res.write(`data: ${JSON.stringify({ type: 'log', content: line, timestamp: new Date().toISOString() })}\n\n`);
                        }
                    });
                });

                lastSize = currentSize;
            }
        } catch (error: any) {
            logger.error('Error in log stream:', error);
        }
    }, 2000);

    // Cleanup on client disconnect
    req.on('close', () => {
        clearInterval(interval);
        res.end();
    });
});

/**
 * GET /api/logs/recent?lines=50&token=YOUR_TOKEN
 * View recent general logs
 */
router.get('/recent', requireAuth, (req: Request, res: Response) => {
    try {
        const lines = parseInt(req.query.lines as string) || 50;
        const logPath = path.join(__dirname, '../../logs/application.log');

        if (!fs.existsSync(logPath)) {
            return res.status(404).json({
                error: 'Log file not found'
            });
        }

        const logContent = fs.readFileSync(logPath, 'utf-8');
        const recentLogs = logContent.split('\n').slice(-lines);

        res.json({
            success: true,
            count: recentLogs.length,
            logs: recentLogs,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        logger.error('Error reading logs:', error);
        res.status(500).json({
            error: 'Failed to read logs',
            message: error.message
        });
    }
});

export default router;
