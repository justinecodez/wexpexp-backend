import { Server as SocketIOServer } from 'socket.io';
import logger from '../config/logger';

/**
 * Global Socket.IO instance holder for emitting events from services
 * This allows services like WhatsApp to emit real-time status updates
 */
class SocketEmitter {
    private io: SocketIOServer | null = null;

    setIO(io: SocketIOServer) {
        this.io = io;
        logger.info('SocketEmitter: Socket.IO instance configured');
    }

    getIO(): SocketIOServer | null {
        return this.io;
    }

    /**
     * Emit a message status update to all connected clients
     */
    emitMessageStatusUpdate(data: {
        messageId: string;
        whatsappMessageId: string;
        status: string;
        conversationId?: string;
        timestamp: string;
    }) {
        if (!this.io) {
            logger.warn('SocketEmitter: Cannot emit - Socket.IO not initialized');
            return;
        }

        logger.info(`SocketEmitter: Broadcasting message-status-update`, data);
        this.io.emit('message-status-update', data);
    }

    /**
     * Emit a new incoming message to all connected clients
     */
    emitNewMessage(data: {
        messageId: string;
        conversationId: string;
        phoneNumber: string;
        content: string;
        direction: 'inbound' | 'outbound';
        timestamp: string;
    }) {
        if (!this.io) {
            logger.warn('SocketEmitter: Cannot emit - Socket.IO not initialized');
            return;
        }

        logger.info(`SocketEmitter: Broadcasting new-message`, { messageId: data.messageId });
        this.io.emit('new-message', data);
    }

    /**
     * Emit to a specific user room
     */
    emitToUser(userId: string, event: string, data: any) {
        if (!this.io) {
            logger.warn('SocketEmitter: Cannot emit - Socket.IO not initialized');
            return;
        }

        this.io.to(`user_${userId}`).emit(event, data);
    }

    /**
     * Broadcast to all connected clients
     */
    broadcast(event: string, data: any) {
        if (!this.io) {
            logger.warn('SocketEmitter: Cannot emit - Socket.IO not initialized');
            return;
        }

        this.io.emit(event, data);
    }
}

// Singleton instance
const socketEmitter = new SocketEmitter();
export default socketEmitter;
