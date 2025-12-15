import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from './User';
import { Message } from './Message';
import { Event } from './Event';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'phone_number' })
  phoneNumber!: string;

  @Column({ name: 'contact_name', nullable: true })
  contactName!: string;

  @Column({
    type: 'simple-enum',
    enum: ['WHATSAPP', 'SMS'],
    default: 'WHATSAPP'
  })
  channel!: 'WHATSAPP' | 'SMS';

  @Column({ name: 'last_message_at', nullable: true })
  lastMessageAt!: Date;

  @Column({ name: 'unread_count', default: 0 })
  unreadCount!: number;

  @Column({ name: 'event_id', nullable: true })
  eventId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Event, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'event_id' })
  event?: Event;

  @OneToMany(() => Message, (message) => message.conversation, { cascade: true })
  messages!: Message[];
}

