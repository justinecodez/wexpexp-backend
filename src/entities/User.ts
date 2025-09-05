import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserRole, BusinessType } from './enums';
import { Event } from './Event';
import { Booking } from './Booking';
import { Notification } from './Notification';
import { LandingPageContent } from './LandingPageContent';
import { Budget } from './Budget';
import { CarImportInquiry } from './CarImportInquiry';
import { InsurancePolicy } from './InsurancePolicy';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  email!: string;

  @Column({ type: 'varchar', name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'varchar', name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar', name: 'last_name' })
  lastName!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  phone!: string | null;

  @Column({
    type: 'varchar',
    enum: UserRole,
    default: UserRole.USER,
  })
  role!: UserRole;

  @Column({ type: 'boolean', name: 'is_verified', default: false })
  isVerified!: boolean;

  @Column({ type: 'datetime', name: 'email_verified_at', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ type: 'varchar', name: 'profile_image', nullable: true })
  profileImage!: string | null;

  @Column({ type: 'varchar', name: 'company_name', nullable: true })
  companyName!: string | null;

  @Column({
    type: 'varchar',
    enum: BusinessType,
    name: 'business_type',
    nullable: true,
  })
  businessType!: BusinessType | null;

  @Column({ type: 'varchar', name: 'refresh_token', nullable: true })
  refreshToken!: string | null;

  @Column({ type: 'varchar', name: 'reset_token', nullable: true })
  resetToken!: string | null;

  @Column({ type: 'datetime', name: 'reset_token_expiry', nullable: true })
  resetTokenExpiry!: Date | null;

  @Column({ type: 'varchar', name: 'email_verification_token', nullable: true })
  emailVerificationToken!: string | null;

  @Column({ type: 'datetime', name: 'email_verification_token_expiry', nullable: true })
  emailVerificationTokenExpiry!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @OneToMany(() => Event, event => event.user)
  events!: Event[];

  @OneToMany(() => Booking, booking => booking.user)
  bookings!: Booking[];

  @OneToMany(() => Notification, notification => notification.user)
  notifications!: Notification[];

  @OneToMany(() => LandingPageContent, content => content.updater)
  landingContent!: LandingPageContent[];

  @OneToMany(() => Budget, budget => budget.user)
  budgets!: Budget[];

  @OneToMany(() => CarImportInquiry, inquiry => inquiry.user)
  carImportInquiries!: CarImportInquiry[];

  @OneToMany(() => InsurancePolicy, policy => policy.user)
  insurancePolicies!: InsurancePolicy[];
}
