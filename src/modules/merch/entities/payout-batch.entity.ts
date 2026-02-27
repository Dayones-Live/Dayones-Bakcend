import {
  BaseEntity,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '@user/entities/user.entity';
import { OrderLedger } from './order-ledger.entity';
import { PayoutBatchStatus } from '../constants';

@Entity('payout_batches')
export class PayoutBatch extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  @Index()
  artist_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'artist_id' })
  artist: User;

  @Column({ nullable: true })
  stripe_transfer_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_amount: number;

  @Column({ type: 'int' })
  order_count: number;

  @Column({ type: 'date' })
  period_start: Date;

  @Column({ type: 'date' })
  period_end: Date;

  @Column({
    type: 'enum',
    enum: PayoutBatchStatus,
    default: PayoutBatchStatus.PENDING,
  })
  status: PayoutBatchStatus;

  @OneToMany(() => OrderLedger, (ledger) => ledger.payoutBatch)
  ledgerEntries: OrderLedger[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
