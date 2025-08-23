import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Event } from './Event';

@Entity('ecards')
export class ECard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id' })
  eventId: string;

  @Column({ name: 'template_name' })
  templateName: string;

  @Column('json', { name: 'custom_design_data', nullable: true })
  customDesignData: any;

  @Column({ name: 'background_image', nullable: true })
  backgroundImage: string;

  @Column({ name: 'logo_image', nullable: true })
  logoImage: string;

  @Column('json', { name: 'color_scheme', nullable: true })
  colorScheme: any;

  @Column({ name: 'message_content', nullable: true })
  messageContent: string;

  @Column({ name: 'font_style', nullable: true })
  fontStyle: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Event, event => event.eCards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;
}
