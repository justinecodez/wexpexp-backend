import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { InvitationMethod, DeliveryStatus } from './enums';

@Entity('message_logs')
export class MessageLog {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'recipient_type', type: 'varchar', nullable: true })
    recipientType!: string;

    @Column({ name: 'recipient' })
    recipient!: string;

    @Column({
        type: 'varchar',
        enum: InvitationMethod,
        name: 'method',
    })
    method!: InvitationMethod;

    @Column({ name: 'subject', nullable: true })
    subject?: string;

    @Column({ name: 'content', type: 'text', nullable: true })
    content?: string;

    @Column({
        type: 'varchar',
        enum: DeliveryStatus,
        name: 'status',
        default: DeliveryStatus.PENDING,
    })
    status!: DeliveryStatus;

    @Column({ name: 'delivered_at', nullable: true })
    deliveredAt?: Date;

    @Column({ name: 'error_message', type: 'text', nullable: true })
    errorMessage?: string;

    @Column({ name: 'metadata', type: 'json', nullable: true })
    metadata?: any;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
