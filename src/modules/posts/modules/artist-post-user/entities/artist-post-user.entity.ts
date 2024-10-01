import { IsNotEmpty, IsUUID } from 'class-validator';
import { User } from '@user/entities/user.entity';
import {
  BaseEntity,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ArtistPost } from '../../artist-post/entities/artist-post.entity';
import { Invite_Status } from '../constants/constants';
import { Comments } from '../../comments/entities/comments.entity';
import { Reactions } from '../../reactions/entities/reaction.entity';

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

  @Column({ type: 'enum', enum: Invite_Status, nullable: false })
  @IsNotEmpty({ message: 'Invite Status is required' })
  status: Invite_Status;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;

  @OneToMany(() => Comments, (comments) => comments.artistPostUser)
  comment?: Comments[];

  @OneToOne(() => Reactions, (reaction) => reaction.artistPostUser)
  reaction: Reactions;
}
