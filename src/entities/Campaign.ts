import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
} from 'typeorm';
import { User } from './User';
import { CampaignStatus } from './enums';

@Entity('campaigns')
export class Campaign {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 255 })
    name!: string;

    @Column({ name: 'template_name', type: 'varchar', length: 255 })
    templateName!: string;

    @Column({ name: 'attachment_url', type: 'text', nullable: true })
    attachmentUrl?: string;

    @Column({ name: 'attachment_type', type: 'varchar', length: 50, nullable: true })
    attachmentType?: string;

    @Column({
        type: 'varchar',
        length: 50,
        default: CampaignStatus.DRAFT,
    })
    status!: CampaignStatus;

    @Column({ type: 'varchar', length: 10, default: 'en' })
    language!: 'en' | 'sw';

    @Column({ name: 'total_recipients', type: 'integer', default: 0 })
    totalRecipients!: number;

    @Column({ name: 'sent_count', type: 'integer', default: 0 })
    sentCount!: number;

    @Column({ name: 'delivered_count', type: 'integer', default: 0 })
    deliveredCount!: number;

    @Column({ name: 'failed_count', type: 'integer', default: 0 })
    failedCount!: number;

    @Column({ name: 'scheduled_at', type: 'datetime', nullable: true })
    scheduledAt?: Date;

    @Column({ name: 'started_at', type: 'datetime', nullable: true })
    startedAt?: Date;

    @Column({ name: 'completed_at', type: 'datetime', nullable: true })
    completedAt?: Date;

    @ManyToOne(() => User, { eager: true, nullable: true })
    @JoinColumn({ name: 'created_by_id' })
    createdBy?: User;

    @OneToMany('CampaignRecipient', 'campaign', {
        cascade: true,
    })
    recipients!: any[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
