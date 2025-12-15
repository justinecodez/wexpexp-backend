import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InvitationMethod, DeliveryStatus, RSVPStatus } from './enums';
import { Event } from './Event';

@Entity('invitations')
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id' })
  eventId!: string;

  @Column({ name: 'guest_name' })
  guestName!: string;

  @Column({ name: 'guest_email', nullable: true })
  guestEmail!: string;

  @Column({ name: 'guest_phone', nullable: true })
  guestPhone!: string;

  @Column({
    type: 'varchar',
    enum: InvitationMethod,
    name: 'invitation_method',
  })
  invitationMethod!: InvitationMethod;

  @Column({ name: 'sent_at', nullable: true })
  sentAt!: Date;

  @Column({
    type: 'varchar',
    enum: DeliveryStatus,
    name: 'delivery_status',
    default: DeliveryStatus.PENDING,
  })
  deliveryStatus!: DeliveryStatus;

  @Column({
    type: 'varchar',
    enum: RSVPStatus,
    name: 'rsvp_status',
    default: RSVPStatus.PENDING,
  })
  rsvpStatus!: RSVPStatus;

  @Column({ name: 'rsvp_at', nullable: true })
  rsvpAt!: Date;

  @Column({ name: 'plus_one_count', default: 0 })
  plusOneCount!: number;

  @Column({ name: 'qr_code', unique: true, nullable: true })
  qrCode!: string;

  @Column({ name: 'qr_code_url', nullable: true })
  qrCodeUrl!: string;

  @Column({ name: 'check_in_code', unique: true, nullable: true, length: 6 })
  checkInCode!: string;

  @Column({ name: 'card_url', nullable: true })
  cardUrl!: string;

  @Column({ name: 'personalized_message', type: 'text', nullable: true })
  personalizedMessage!: string;

  @Column({ name: 'token', nullable: true })
  token!: string;

  @Column({ name: 'check_in_time', nullable: true })
  checkInTime!: Date;

  @Column({ name: 'special_requirements', nullable: true })
  specialRequirements!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Event, event => event.invitations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event!: Event;
}
