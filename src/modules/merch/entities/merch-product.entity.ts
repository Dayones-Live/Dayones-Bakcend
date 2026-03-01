import {
  BaseEntity,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MerchDrop } from './merch-drop.entity';
import { ProductType } from '../constants';

@Entity('merch_products')
export class MerchProduct extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  @Index()
  merch_drop_id: string;

  @ManyToOne(() => MerchDrop, (drop) => drop.products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'merch_drop_id' })
  merchDrop: MerchDrop;

  @Column({ type: 'bigint', nullable: true })
  printful_product_id: number;

  @Column({ type: 'bigint', nullable: true })
  printful_variant_id: number;

  @Column({ type: 'int', nullable: true })
  printful_catalog_product_id: number;

  @Column({ type: 'enum', enum: ProductType })
  product_type: ProductType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  retail_price: number;

  @Column({ nullable: true })
  size: string;

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  color_code: string;

  @Column({ nullable: true })
  image_url: string;

  @Column({ nullable: true })
  mockup_url: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
