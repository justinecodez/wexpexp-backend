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
import { InsurancePlan } from './InsurancePlan';

@Entity('insurance_policies')
export class InsurancePolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'plan_id' })
  planId: string;

  @Column({ unique: true, name: 'policy_number' })
  policyNumber: string;

  @Column({ name: 'start_date' })
  startDate: Date;

  @Column({ name: 'end_date' })
  endDate: Date;

  @Column('decimal', { precision: 10, scale: 2, name: 'premium_tzs' })
  premiumTzs: number;

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column('json', { nullable: true })
  beneficiary: any;

  @Column({ name: 'claims_made', default: 0 })
  claimsMade: number;

  @Column('json', { nullable: true })
  documents: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, user => user.insurancePolicies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => InsurancePlan, plan => plan.policies)
  @JoinColumn({ name: 'plan_id' })
  plan: InsurancePlan;
}
