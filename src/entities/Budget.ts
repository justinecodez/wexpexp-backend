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

@Entity('budgets')
export class Budget {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'event_id', nullable: true })
  eventId!: string;

  @Column()
  name!: string;

  @Column('decimal', { precision: 12, scale: 2, name: 'total_budget' })
  totalBudget!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column('json')
  categories!: any;

  @Column('decimal', { precision: 12, scale: 2, name: 'actual_spent', default: 0 })
  actualSpent!: number;

  @Column('decimal', { precision: 12, scale: 2, name: 'remaining_budget' })
  remainingBudget!: number;

  @Column({ default: 'ACTIVE' })
  status!: string;

  @Column({ nullable: true })
  notes!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => User, user => user.budgets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
