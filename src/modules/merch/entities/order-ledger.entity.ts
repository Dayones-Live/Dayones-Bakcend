import {
  BaseEntity,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MerchOrder } from './merch-order.entity';
import { PayoutBatch } from './payout-batch.entity';
import { LedgerStatus } from '../constants';

@Entity('order_ledger')
export class OrderLedger extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  @Index()
  merch_order_id: string;

  @ManyToOne(() => MerchOrder, (order) => order.ledgerEntries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'merch_order_id' })
  merchOrder: MerchOrder;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  gross_revenue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  stripe_fee: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  printful_cost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  net_profit: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  artist_share: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  platform_share: number;

  @Column({
    type: 'enum',
    enum: LedgerStatus,
    default: LedgerStatus.PENDING,
  })
  status: LedgerStatus;

  @Column({ nullable: true })
  @Index()
  payout_batch_id: string;

  @ManyToOne(() => PayoutBatch, (batch) => batch.ledgerEntries, {
    nullable: true,
  })
  @JoinColumn({ name: 'payout_batch_id' })
  payoutBatch: PayoutBatch;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
