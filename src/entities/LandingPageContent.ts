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

@Entity('landing_page_content')
export class LandingPageContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'section_type' })
  sectionType: string;

  @Column('json', { name: 'content_data' })
  contentData: any;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'updated_by' })
  updatedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, user => user.landingContent)
  @JoinColumn({ name: 'updated_by' })
  updater: User;
}
