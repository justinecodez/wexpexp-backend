import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { InsurancePolicy } from './InsurancePolicy';

@Entity('insurance_plans')
export class InsurancePlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ name: 'coverage_type' })
  coverageType: string;

  @Column('decimal', { precision: 10, scale: 2, name: 'base_price_tzs' })
  basePriceTzs: number;

  @Column('decimal', { precision: 12, scale: 2, name: 'max_coverage' })
  maxCoverage: number;

  @Column()
  duration: string;

  @Column('json')
  benefits: string[];

  @Column('json', { nullable: true })
  exclusions: string[];

  @Column('json', { nullable: true })
  terms: any;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => InsurancePolicy, policy => policy.plan)
  policies: InsurancePolicy[];
}
