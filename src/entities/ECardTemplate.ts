import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ecard_templates')
export class ECardTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  thumbnail: string;

  @Column('json', { name: 'template_data' })
  templateData: any;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_premium', default: false })
  isPremium: boolean;

  @Column('json', { nullable: true })
  tags: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
