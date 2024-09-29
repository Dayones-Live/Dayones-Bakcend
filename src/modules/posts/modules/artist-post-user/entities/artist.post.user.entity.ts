import { IsNotEmpty, IsUUID } from 'class-validator';
import { User } from 'src/modules/user/entities/user.entity';
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
import { ArtistPost } from '../../artist-post/entities/artist.post.entity';
import { INVITE_STATUS } from '../constants/constants';

@Entity({ name: 'artist_post_user' })
@Unique(['id'])
export class ArtistPostUser extends BaseEntity {
  @Column()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  @IsUUID()
  @Index()
  user_id: string;

  @ManyToOne(() => User, (user) => user.artistPostUser, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: false })
  @IsUUID()
  @Index()
  artist_post_id: string;

  @ManyToOne(() => ArtistPost, (artistPost) => artistPost.artistPostUser, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'artist_post_id' })
  artistPost: ArtistPost;

  @Column({ nullable: false })
  @IsNotEmpty({ message: 'Valid Till is  required' })
  valid_till: Date;

  @Column({ type: 'enum', enum: INVITE_STATUS, nullable: false })
  @IsNotEmpty({ message: 'Invite Status is required' })
  status: INVITE_STATUS;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
