import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';

@Entity('car_import_inquiries')
export class CarImportInquiry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'vehicle_make' })
  vehicleMake: string;

  @Column({ name: 'vehicle_model' })
  vehicleModel: string;

  @Column({ name: 'vehicle_year' })
  vehicleYear: number;

  @Column({ name: 'origin_country' })
  originCountry: string;

  @Column('decimal', { precision: 12, scale: 2, name: 'estimated_value', nullable: true })
  estimatedValue: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ name: 'inquiry_type' })
  inquiryType: string;

  @Column({ name: 'current_location', nullable: true })
  currentLocation: string;

  @Column({ nullable: true })
  timeframe: string;

  @Column({ name: 'additional_details', nullable: true })
  additionalDetails: string;

  @Column({ default: 'PENDING' })
  status: string;

  @Column('decimal', { precision: 12, scale: 2, name: 'estimated_cost', nullable: true })
  estimatedCost: number;

  @Column('json', { nullable: true })
  documents: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, user => user.carImportInquiries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
