import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('event_analytics')
export class EventAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id' })
  eventId: string;

  @Column({ name: 'total_invitations' })
  totalInvitations: number;

  @Column({ name: 'total_accepted' })
  totalAccepted: number;

  @Column({ name: 'total_declined' })
  totalDeclined: number;

  @Column({ name: 'total_pending' })
  totalPending: number;

  @Column({ name: 'total_checked_in' })
  totalCheckedIn: number;

  @Column('float', { name: 'acceptance_rate' })
  acceptanceRate: number;

  @Column('float', { name: 'attendance_rate' })
  attendanceRate: number;

  @Column('float', { name: 'email_delivery_rate' })
  emailDeliveryRate: number;

  @Column('float', { name: 'sms_delivery_rate' })
  smsDeliveryRate: number;

  @Column('float', { name: 'whatsapp_delivery_rate' })
  whatsappDeliveryRate: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
