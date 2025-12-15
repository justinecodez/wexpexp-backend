import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Conversation } from './Conversation';

export enum MessageDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id' })
  conversationId!: string;

  @Column({ name: 'whatsapp_message_id', nullable: true })
  whatsappMessageId!: string;

  @Column({
    type: 'varchar',
    enum: MessageDirection,
  })
  direction!: MessageDirection;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'varchar',
    enum: MessageStatus,
    default: MessageStatus.SENT,
  })
  status!: MessageStatus;

  @Column({ name: 'message_type', default: 'text' })
  messageType!: string; // text, image, template, etc.

  @Column({
    type: 'simple-enum',
    enum: ['WHATSAPP', 'SMS'],
    default: 'WHATSAPP'
  })
  channel!: 'WHATSAPP' | 'SMS';

  @Column('json', { nullable: true })
  metadata!: any; // Store media URLs, template info, etc.

  @Column({ name: 'sent_at', nullable: true })
  sentAt!: Date;

  @Column({ name: 'delivered_at', nullable: true })
  deliveredAt!: Date;

  @Column({ name: 'read_at', nullable: true })
  readAt!: Date;

  @Column({ name: 'error_message', nullable: true, type: 'text' })
  errorMessage!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // Relations
  @ManyToOne(() => Conversation, (conversation) => conversation.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;
}

