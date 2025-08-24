import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ServiceType, BookingStatus, PaymentStatus } from './enums';
import { User } from './User';
import { Tour } from './Tour';
import { Vehicle } from './Vehicle';
import { Accommodation } from './Accommodation';
import { Venue } from './Venue';
import { Decoration } from './Decoration';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({
    type: 'varchar',
    enum: ServiceType,
    name: 'service_type',
  })
  serviceType!: ServiceType;

  @Column({ name: 'service_id' })
  serviceId!: string;

  @Column({ name: 'booking_date' })
  bookingDate!: Date;

  @Column({ name: 'start_date', nullable: true })
  startDate!: Date;

  @Column({ name: 'end_date', nullable: true })
  endDate!: Date;

  @Column({ nullable: true })
  guests!: number;

  @Column('decimal', { precision: 12, scale: 2, name: 'total_amount_tzs' })
  totalAmountTzs!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({
    type: 'varchar',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status!: BookingStatus;

  @Column({
    type: 'varchar',
    enum: PaymentStatus,
    name: 'payment_status',
    default: PaymentStatus.PENDING,
  })
  paymentStatus!: PaymentStatus;

  @Column({ name: 'payment_method', nullable: true })
  paymentMethod!: string;

  @Column({ name: 'transaction_id', nullable: true })
  transactionId!: string;

  @Column({ name: 'special_requests', nullable: true })
  specialRequests!: string;

  @Column({ name: 'cancellation_reason', nullable: true })
  cancellationReason!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => User, user => user.bookings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Tour, tour => tour.bookings, { nullable: true })
  @JoinColumn({ name: 'service_id' })
  tour!: Tour;

  @ManyToOne(() => Vehicle, vehicle => vehicle.bookings, { nullable: true })
  @JoinColumn({ name: 'service_id' })
  vehicle!: Vehicle;

  @ManyToOne(() => Accommodation, accommodation => accommodation.bookings, { nullable: true })
  @JoinColumn({ name: 'service_id' })
  accommodation!: Accommodation;

  @ManyToOne(() => Venue, venue => venue.bookings, { nullable: true })
  @JoinColumn({ name: 'service_id' })
  venue!: Venue;

  @ManyToOne(() => Decoration, decoration => decoration.bookings, { nullable: true })
  @JoinColumn({ name: 'service_id' })
  decoration!: Decoration;
}
