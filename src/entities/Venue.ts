import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TanzaniaCity } from './enums';
import { Booking } from './Booking';

@Entity('venues')
export class Venue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'varchar',
    enum: TanzaniaCity,
  })
  location: TanzaniaCity;

  @Column({ nullable: true })
  address: string;

  @Column()
  capacity: number;

  @Column('decimal', { precision: 12, scale: 2, name: 'price_per_event_tzs' })
  pricePerEventTzs: number;

  @Column('json', { nullable: true })
  amenities: string[];

  @Column({ name: 'venue_type' })
  venueType: string;

  @Column('json', { nullable: true })
  images: string[];

  @Column('json', { nullable: true })
  coordinates: { latitude: number; longitude: number };

  @Column('json', { name: 'available_services', nullable: true })
  availableServices: string[];

  @Column('json', { nullable: true })
  contact: any;

  @Column('json', { name: 'working_hours', nullable: true })
  workingHours: any;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Booking, booking => booking.venue)
  bookings: Booking[];
}
