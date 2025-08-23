import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Booking } from './Booking';

@Entity('decorations')
export class Decoration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'package_name' })
  packageName: string;

  @Column()
  description: string;

  @Column('decimal', { precision: 10, scale: 2, name: 'price_tzs' })
  priceTzs: number;

  @Column('json', { nullable: true })
  images: string[];

  @Column('json', { nullable: true })
  services: string[];

  @Column('json', { name: 'suitable_for', nullable: true })
  suitableFor: string[];

  @Column({ name: 'setup_time', nullable: true })
  setupTime: string;

  @Column({ nullable: true })
  coverage: string;

  @Column('json', { nullable: true })
  extras: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Booking, booking => booking.decoration)
  bookings: Booking[];
}
