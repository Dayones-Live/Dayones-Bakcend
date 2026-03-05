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
import { MerchDrop } from './merch-drop.entity';
import { MerchOrderItem } from './merch-order-item.entity';
import { OrderLedger } from './order-ledger.entity';
import { MerchOrderStatus } from '../constants';

@Entity('merch_orders')
export class MerchOrder extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false, unique: true })
  order_number: string;

  @Column({ nullable: false })
  @Index()
  merch_drop_id: string;

  @ManyToOne(() => MerchDrop, (drop) => drop.orders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'merch_drop_id' })
  merchDrop: MerchDrop;

  @Column({ nullable: false })
  @Index()
  fan_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fan_id' })
  fan: User;

  @Column({ nullable: false })
  @Index()
  artist_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'artist_id' })
  artist: User;

  @Column({ nullable: true })
  stripe_payment_intent_id: string;

  @Column({ type: 'bigint', nullable: true })
  printful_order_id: number;

  @Column({
    type: 'enum',
    enum: MerchOrderStatus,
    default: MerchOrderStatus.PENDING,
  })
  status: MerchOrderStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  shipping_cost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ type: 'jsonb', nullable: true })
  shipping_address: Record<string, any>;

  @Column({ nullable: true })
  tracking_number: string;

  @Column({ nullable: true })
  tracking_url: string;

  @OneToMany(() => MerchOrderItem, (item) => item.merchOrder)
  items: MerchOrderItem[];

  @OneToMany(() => OrderLedger, (ledger) => ledger.merchOrder)
  ledgerEntries: OrderLedger[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
