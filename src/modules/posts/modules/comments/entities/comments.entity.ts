import { IsUUID } from 'class-validator';
import {
  BaseEntity,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ArtistPostUser } from '../../artist-post-user/entities/artist-post-user.entity';

@Entity({ name: 'comments' })
@Unique(['id'])
export class Comments extends BaseEntity {
  @Column()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  @IsUUID()
  @Index()
  artist_post_user_id: string;

  @ManyToOne(() => ArtistPostUser, (artistPostUser) => artistPostUser.comment, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'artist_post_user_id' })
  artistPostUser: ArtistPostUser;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ nullable: true })
  message: string;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
