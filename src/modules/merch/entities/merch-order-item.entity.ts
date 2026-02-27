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
import { MerchProduct } from './merch-product.entity';

@Entity('merch_order_items')
export class MerchOrderItem extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  @Index()
  merch_order_id: string;

  @ManyToOne(() => MerchOrder, (order) => order.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'merch_order_id' })
  merchOrder: MerchOrder;

  @Column({ nullable: false })
  @Index()
  merch_product_id: string;

  @ManyToOne(() => MerchProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merch_product_id' })
  merchProduct: MerchProduct;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  printful_cost: number;

  @Column({ nullable: true })
  size: string;

  @Column({ nullable: true })
  color: string;
}
