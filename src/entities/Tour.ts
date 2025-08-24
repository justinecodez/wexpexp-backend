import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TanzaniaCity, TourCategory } from './enums';
import { Booking } from './Booking';

@Entity('tours')
export class Tour {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  description!: string;

  @Column()
  duration!: string;

  @Column('decimal', { precision: 12, scale: 2, name: 'price_tzs' })
  priceTzs!: number;

  @Column({
    type: 'varchar',
    enum: TanzaniaCity,
  })
  location!: TanzaniaCity;

  @Column({
    type: 'varchar',
    enum: TourCategory,
  })
  category!: TourCategory;

  @Column('json', { nullable: true })
  images!: string[];

  @Column('json', { nullable: true })
  itinerary!: any;

  @Column('json', { nullable: true })
  inclusions!: string[];

  @Column('json', { nullable: true })
  exclusions!: string[];

  @Column({ name: 'max_people' })
  maxPeople!: number;

  @Column({ nullable: true })
  difficulty!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @OneToMany(() => Booking, booking => booking.tour)
  bookings!: Booking[];
}
