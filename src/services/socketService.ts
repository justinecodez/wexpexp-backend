import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import database from '../config/database';
import { User } from '../entities/User';
import { Event } from '../entities/Event';
import { Notification } from '../entities/Notification';
import config from '../config';
import { JWTPayload } from '../types';
import logger from '../config/logger';

export class SocketService {
  private io: SocketIOServer;
  private authenticatedUsers: Map<string, { socketId: string; userId: string }> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  /**
   * Setup Socket.IO middleware for authentication
   */
  private setupMiddleware(): void {
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

        if (!token) {
          logger.warn('Socket connection without token - allowing anonymous connection');
          socket.data.user = null;
          return next();
        }

        // Verify JWT token
        const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;
        logger.info('Socket token verified', { userId: decoded.userId });

        // Check if user exists and is verified
        const userRepository = database.getRepository(User);
        const user = await userRepository.findOne({
          where: { id: decoded.userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isVerified: true,
          },
        });

        if (!user) {
          logger.error('Socket auth failed: User not found', { userId: decoded.userId });
          return next(new Error('Authentication failed: User not found'));
        }

        if (!user.isVerified) {
          logger.warn('Socket auth failed: User not verified', {
            userId: user.id,
            email: user.email
          });
          // Allow connection but log the warning - don't block for dev purposes
          // In production, you may want to uncomment the line below:
          // return next(new Error('Authentication failed: User not verified'));
        }

        socket.data.user = user;
        logger.info('Socket authenticated successfully', {
          userId: user.id,
          email: user.email,
          isVerified: user.isVerified
        });
        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        if (error instanceof jwt.JsonWebTokenError) {
          next(new Error('Authentication failed: Invalid token'));
        } else if (error instanceof jwt.TokenExpiredError) {
          next(new Error('Authentication failed: Token expired'));
        } else {
          next(new Error('Authentication failed'));
        }
      }
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', socket => {
      const user = socket.data.user;

      if (user) {
        logger.info(`Authenticated user connected: ${user.email} (${socket.id})`);
        this.authenticatedUsers.set(socket.id, { socketId: socket.id, userId: user.id });

        // Join user-specific room
        socket.join(`user_${user.id}`);

        // Send welcome message
        socket.emit('connected', {
          message: `Welcome ${user.firstName}!`,
          userId: user.id,
        });
      } else {
        logger.info(`Anonymous user connected: ${socket.id}`);
      }

      // Event-specific handlers
      this.setupEventHandlers_Events(socket);
      this.setupEventHandlers_Invitations(socket);
      this.setupEventHandlers_Bookings(socket);
      this.setupEventHandlers_Chat(socket);

      // Handle disconnection
      socket.on('disconnect', () => {
        if (user) {
          logger.info(`User disconnected: ${user.email} (${socket.id})`);
          this.authenticatedUsers.delete(socket.id);
        } else {
          logger.info(`Anonymous user disconnected: ${socket.id}`);
        }
      });

      // Handle errors
      socket.on('error', error => {
        logger.error(`Socket error from ${socket.id}:`, error);
      });
    });
  }

  /**
   * Event-related real-time handlers
   */
  private setupEventHandlers_Events(socket: any): void {
    // Join event room for real-time updates
    socket.on('join-event', async (eventId: string) => {
      if (!socket.data.user) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }

      try {
        // Verify user has access to this event
        const eventRepository = database.getRepository(Event);
        const event = await eventRepository.findOne({
          where: { id: eventId },
          select: { userId: true, isPublic: true },
        });

        if (!event) {
          socket.emit('error', { message: 'Event not found' });
          return;
        }

        if (!event.isPublic && event.userId !== socket.data.user.id) {
          socket.emit('error', { message: 'Access denied to this event' });
          return;
        }

        socket.join(`event_${eventId}`);
        socket.emit('joined-event', { eventId });
        logger.info(`User ${socket.data.user.id} joined event room: ${eventId}`);
      } catch (error) {
        logger.error('Error joining event room:', error);
        socket.emit('error', { message: 'Failed to join event room' });
      }
    });

    // Leave event room
    socket.on('leave-event', (eventId: string) => {
      socket.leave(`event_${eventId}`);
      socket.emit('left-event', { eventId });
      logger.info(`User ${socket.data.user?.id || 'anonymous'} left event room: ${eventId}`);
    });

    // Real-time event updates
    socket.on('event-update', (data: { eventId: string; update: any }) => {
      if (!socket.data.user) return;

      socket.to(`event_${data.eventId}`).emit('event-updated', {
        eventId: data.eventId,
        update: data.update,
        updatedBy: socket.data.user.id,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Invitation-related real-time handlers
   */
  private setupEventHandlers_Invitations(socket: any): void {
    // RSVP updates
    socket.on(
      'rsvp-update',
      (data: { invitationId: string; rsvpStatus: string; eventId: string }) => {
        // Broadcast to event organizer and other participants
        socket.to(`event_${data.eventId}`).emit('rsvp-updated', {
          invitationId: data.invitationId,
          rsvpStatus: data.rsvpStatus,
          timestamp: new Date().toISOString(),
        });
      }
    );

    // Guest check-in
    socket.on(
      'guest-checkin',
      (data: { invitationId: string; eventId: string; guestName: string }) => {
        socket.to(`event_${data.eventId}`).emit('guest-checked-in', {
          invitationId: data.invitationId,
          guestName: data.guestName,
          timestamp: new Date().toISOString(),
        });
      }
    );
  }

  /**
   * Booking-related real-time handlers
   */
  private setupEventHandlers_Bookings(socket: any): void {
    // Join booking room for updates
    socket.on('join-booking', (bookingId: string) => {
      if (!socket.data.user) return;

      socket.join(`booking_${bookingId}`);
      socket.emit('joined-booking', { bookingId });
      logger.info(`User ${socket.data.user.id} joined booking room: ${bookingId}`);
    });

    // Leave booking room
    socket.on('leave-booking', (bookingId: string) => {
      socket.leave(`booking_${bookingId}`);
      socket.emit('left-booking', { bookingId });
    });

    // Booking status updates
    socket.on('booking-update', (data: { bookingId: string; status: string }) => {
      socket.to(`booking_${data.bookingId}`).emit('booking-updated', {
        bookingId: data.bookingId,
        status: data.status,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Chat/messaging handlers
   */
  private setupEventHandlers_Chat(socket: any): void {
    // Join chat room (could be event-based or booking-based)
    socket.on('join-chat', (roomId: string) => {
      if (!socket.data.user) return;

      socket.join(`chat_${roomId}`);
      socket.emit('joined-chat', { roomId });

      // Notify others that user joined
      socket.to(`chat_${roomId}`).emit('user-joined-chat', {
        userId: socket.data.user.id,
        userName: `${socket.data.user.firstName} ${socket.data.user.lastName}`,
        timestamp: new Date().toISOString(),
      });
    });

    // Leave chat room
    socket.on('leave-chat', (roomId: string) => {
      if (!socket.data.user) return;

      socket.leave(`chat_${roomId}`);
      socket.emit('left-chat', { roomId });

      // Notify others that user left
      socket.to(`chat_${roomId}`).emit('user-left-chat', {
        userId: socket.data.user.id,
        userName: `${socket.data.user.firstName} ${socket.data.user.lastName}`,
        timestamp: new Date().toISOString(),
      });
    });

    // Send message
    socket.on('send-message', (data: { roomId: string; message: string; type?: string }) => {
      if (!socket.data.user) return;

      const messageData = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        roomId: data.roomId,
        message: data.message,
        type: data.type || 'text',
        sender: {
          id: socket.data.user.id,
          name: `${socket.data.user.firstName} ${socket.data.user.lastName}`,
          email: socket.data.user.email,
        },
        timestamp: new Date().toISOString(),
      };

      // Send to all users in the chat room including sender
      this.io.to(`chat_${data.roomId}`).emit('message-received', messageData);
    });

    // Typing indicators
    socket.on('typing-start', (roomId: string) => {
      if (!socket.data.user) return;

      socket.to(`chat_${roomId}`).emit('user-typing', {
        userId: socket.data.user.id,
        userName: socket.data.user.firstName,
      });
    });

    socket.on('typing-stop', (roomId: string) => {
      if (!socket.data.user) return;

      socket.to(`chat_${roomId}`).emit('user-stopped-typing', {
        userId: socket.data.user.id,
      });
    });
  }

  /**
   * Emit event to specific user
   */
  public emitToUser(userId: string, event: string, data: any): void {
    this.io.to(`user_${userId}`).emit(event, data);
  }

  /**
   * Emit event to all users in an event
   */
  public emitToEvent(eventId: string, event: string, data: any): void {
    this.io.to(`event_${eventId}`).emit(event, data);
  }

  /**
   * Emit event to all users in a booking
   */
  public emitToBooking(bookingId: string, event: string, data: any): void {
    this.io.to(`booking_${bookingId}`).emit(event, data);
  }

  /**
   * Emit event to all users in a chat room
   */
  public emitToChat(roomId: string, event: string, data: any): void {
    this.io.to(`chat_${roomId}`).emit(event, data);
  }

  /**
   * Broadcast to all connected users
   */
  public broadcast(event: string, data: any): void {
    this.io.emit(event, data);
  }

  /**
   * Get online users count
   */
  public getOnlineUsersCount(): number {
    return this.authenticatedUsers.size;
  }

  /**
   * Get online users in a specific room
   */
  public async getOnlineUsersInRoom(roomName: string): Promise<string[]> {
    const room = this.io.sockets.adapter.rooms.get(roomName);
    return room ? Array.from(room) : [];
  }

  /**
   * Send notification to user
   */
  public async sendNotificationToUser(
    userId: string,
    notification: {
      type: string;
      title: string;
      message: string;
      data?: any;
    }
  ): Promise<void> {
    // Save notification to database
    const notificationRepository = database.getRepository(Notification);
    const notificationEntity = notificationRepository.create({
      userId,
      type: notification.type as any,
      title: notification.title,
      message: notification.message,
      data: notification.data || {},
      isRead: false,
    });

    await notificationRepository.save(notificationEntity);

    // Emit real-time notification
    this.emitToUser(userId, 'notification', {
      ...notification,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send system announcement
   */
  public sendSystemAnnouncement(announcement: {
    title: string;
    message: string;
    type?: string;
    targetUsers?: string[];
  }): void {
    const announcementData = {
      ...announcement,
      timestamp: new Date().toISOString(),
      id: `announcement_${Date.now()}`,
    };

    if (announcement.targetUsers && announcement.targetUsers.length > 0) {
      // Send to specific users
      announcement.targetUsers.forEach(userId => {
        this.emitToUser(userId, 'system-announcement', announcementData);
      });
    } else {
      // Broadcast to all users
      this.broadcast('system-announcement', announcementData);
    }

    logger.info(`System announcement sent: ${announcement.title}`);
  }
}

export default SocketService;
