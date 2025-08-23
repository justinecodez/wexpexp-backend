import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { AccommodationType, TanzaniaCity } from './enums';
import { Booking } from './Booking';

@Entity('accommodations')
export class Accommodation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'varchar',
    enum: AccommodationType,
  })
  type: AccommodationType;

  @Column({
    type: 'varchar',
    enum: TanzaniaCity,
  })
  location: TanzaniaCity;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  description: string;

  @Column('json')
  roomTypes: any;

  @Column('json', { nullable: true })
  amenities: string[];

  @Column('json')
  rates: any;

  @Column('json', { nullable: true })
  images: string[];

  @Column('json', { nullable: true })
  coordinates: { latitude: number; longitude: number };

  @Column({ name: 'check_in_time', nullable: true })
  checkInTime: string;

  @Column({ name: 'check_out_time', nullable: true })
  checkOutTime: string;

  @Column('json', { nullable: true })
  policies: any;

  @Column('float', { nullable: true })
  rating: number;

  @Column({ name: 'total_rooms' })
  totalRooms: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Booking, booking => booking.accommodation)
  bookings: Booking[];
}
