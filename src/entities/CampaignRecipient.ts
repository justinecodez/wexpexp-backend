import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
} from 'typeorm';
import { Campaign } from './Campaign';
import { RecipientStatus } from './enums';

@Entity('campaign_recipients')
export class CampaignRecipient {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => Campaign, (campaign) => campaign.recipients, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'campaign_id' })
    campaign!: Campaign;

    @Column({ type: 'varchar', length: 255, nullable: true })
    name?: string;

    @Column({ type: 'varchar', length: 20 })
    phone!: string;

    @Column({
        type: 'varchar',
        length: 50,
        default: RecipientStatus.PENDING,
    })
    status!: RecipientStatus;

    @Column({ name: 'message_id', type: 'varchar', length: 255, nullable: true })
    messageId?: string;

    @Column({ name: 'sent_at', type: 'datetime', nullable: true })
    sentAt?: Date;

    @Column({ name: 'delivered_at', type: 'datetime', nullable: true })
    deliveredAt?: Date;

    @Column({ name: 'error_message', type: 'text', nullable: true })
    errorMessage?: string;

    @Column({ name: 'conversation_id', type: 'uuid', nullable: true })
    conversationId?: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
