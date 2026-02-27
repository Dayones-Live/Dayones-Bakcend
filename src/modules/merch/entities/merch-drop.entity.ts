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
import { ArtistPost } from '@artist-post/entities/artist-post.entity';
import { MerchProduct } from './merch-product.entity';
import { MerchOrder } from './merch-order.entity';
import { MerchDropStatus } from '../constants';

@Entity('merch_drops')
export class MerchDrop extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false, unique: true })
  @Index()
  artist_post_id: string;

  @ManyToOne(() => ArtistPost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'artist_post_id' })
  artistPost: ArtistPost;

  @Column({ nullable: false })
  @Index()
  artist_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'artist_id' })
  artist: User;

  @Column({
    type: 'enum',
    enum: MerchDropStatus,
    default: MerchDropStatus.CREATING,
  })
  status: MerchDropStatus;

  @Column({ type: 'timestamp', nullable: false })
  expires_at: Date;

  @OneToMany(() => MerchProduct, (product) => product.merchDrop)
  products: MerchProduct[];

  @OneToMany(() => MerchOrder, (order) => order.merchDrop)
  orders: MerchOrder[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
