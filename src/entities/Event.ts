import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { EventType, EventStatus, TanzaniaCity } from './enums';
import { User } from './User';
import { Invitation } from './Invitation';
import { ECard } from './ECard';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column()
  title!: string;

  @Column({ nullable: true })
  description!: string;

  @Column({
    type: 'varchar',
    enum: EventType,
    name: 'event_type',
  })
  eventType!: EventType;

  @Column({ name: 'event_date' })
  eventDate!: Date;

  @Column({ name: 'start_time' })
  startTime!: string;

  @Column({ name: 'end_time', nullable: true })
  endTime!: string;

  @Column({ name: 'host_name', nullable: true })
  hostname?: string;

  @Column({ name: 'bride_name', nullable: true })
  brideName?: string;

  @Column({ name: 'groom_name', nullable: true })
  groomName?: string;

  @Column({ default: 'Africa/Dar_es_Salaam' })
  timezone!: string;

  @Column({ name: 'venue_name', nullable: true })
  venueName!: string;

  @Column({ name: 'venue_address', nullable: true })
  venueAddress!: string;

  @Column({ name: 'venue_city', nullable: true })
  venueCity?: string;

  @Column({ name: 'max_guests' })
  maxGuests!: number;

  @Column({ name: 'current_rsvp_count', default: 0 })
  currentRsvpCount!: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  budget!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({
    type: 'varchar',
    enum: EventStatus,
    default: EventStatus.UPCOMING,
  })
  status!: EventStatus;

  @Column({ name: 'last_autosave_at', type: 'datetime', nullable: true })
  lastAutosaveAt!: Date;

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt!: Date;

  @Column({ name: 'is_public', default: false })
  isPublic!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => User, user => user.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany(() => Invitation, invitation => invitation.event)
  invitations!: Invitation[];

  @OneToMany(() => ECard, ecard => ecard.event)
  eCards!: ECard[];

  @Column({ name: 'message_template', nullable: true })
  messageTemplate!: string;

  @Column({ name: 'template_config', type: 'simple-json', nullable: true })
  templateConfig!: any;
}
