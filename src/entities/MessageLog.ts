import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { InvitationMethod, DeliveryStatus } from './enums';

@Entity('message_logs')
export class MessageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'recipient_type' })
  recipientType: string;

  @Column()
  recipient: string;

  @Column({
    type: 'varchar',
    enum: InvitationMethod,
  })
  method: InvitationMethod;

  @Column({ nullable: true })
  subject: string;

  @Column()
  content: string;

  @Column({
    type: 'varchar',
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING,
  })
  status: DeliveryStatus;

  @Column({ name: 'delivered_at', nullable: true })
  deliveredAt: Date;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column('json', { nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
