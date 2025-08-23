import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { VehicleType, TanzaniaCity } from './enums';
import { Booking } from './Booking';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  make: string;

  @Column()
  model: string;

  @Column()
  year: number;

  @Column({
    type: 'varchar',
    enum: VehicleType,
    name: 'vehicle_type',
  })
  vehicleType: VehicleType;

  @Column('decimal', { precision: 10, scale: 2, name: 'daily_rate_tzs' })
  dailyRateTzs: number;

  @Column('json', { nullable: true })
  features: string[];

  @Column({ name: 'seating_capacity' })
  seatingCapacity: number;

  @Column()
  transmission: string;

  @Column({ name: 'fuel_type' })
  fuelType: string;

  @Column('json', { nullable: true })
  images: string[];

  @Column({
    type: 'varchar',
    enum: TanzaniaCity,
  })
  location: TanzaniaCity;

  @Column({ default: true })
  availability: boolean;

  @Column({ name: 'with_driver', default: false })
  withDriver: boolean;

  @Column('decimal', { precision: 10, scale: 2, name: 'driver_rate_tzs', nullable: true })
  driverRateTzs: number;

  @Column({ name: 'license_plate', nullable: true })
  licensePlate: string;

  @Column('json', { nullable: true })
  insurance: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Booking, booking => booking.vehicle)
  bookings: Booking[];
}
