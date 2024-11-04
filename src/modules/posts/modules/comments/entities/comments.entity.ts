import { IsOptional, IsUUID } from 'class-validator';
import {
  BaseEntity,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ArtistPostUser } from '../../artist-post-user/entities/artist-post-user.entity';
import { CommentReactions } from '../../comment-reactions/entities/comment-reaction.entity';
import { User } from '@app/modules/user/entities/user.entity';
import { Media_Type } from '@app/types';

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

  @Column({ nullable: true })
  @IsUUID()
  @Index()
  parent_comment_id: string;

  @ManyToOne(() => Comments, (comment) => comment.replies, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_comment_id' })
  parentComment: Comments;

  @OneToMany(() => Comments, (comment) => comment.parentComment)
  replies: Comments[];

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

  @OneToMany(
    () => CommentReactions,
    (CommentReactions) => CommentReactions.comment,
  )
  commentReaction: CommentReactions[];

  @Column({ nullable: true })
  @IsUUID()
  @Index()
  comment_by: string;

  @ManyToOne(() => User, (user) => user.comment, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'comment_by' })
  user: User;

  @Column({ nullable: true })
  @IsOptional()
  url: string;

  @Column({ nullable: true })
  @IsOptional()
  media_type: Media_Type;
}
