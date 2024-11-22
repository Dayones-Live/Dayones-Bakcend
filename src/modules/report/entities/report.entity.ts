import { ArtistPost } from '@app/modules/posts/modules/artist-post/entities/artist-post.entity';
import { Comments } from '@app/modules/posts/modules/comments/entities/comments.entity';
import { User } from '@app/modules/user/entities/user.entity';
import { IsUUID } from 'class-validator';
import {
  BaseEntity,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('report')
export class Report extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: false })
  @IsUUID()
  @Index()
  reported_by: string;

  @ManyToOne(() => User, (user) => user.reportBy, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reported_by' })
  reportedBy: User;

  @Column({ nullable: true })
  @IsUUID()
  @Index()
  reported_user_id: string;

  @ManyToOne(() => User, (user) => user.reportTo, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reported_user_id' })
  reportedUser: User;

  @Column({ nullable: true })
  @IsUUID()
  @Index()
  reported_post_id: string;

  @ManyToOne(() => ArtistPost, (artistPost) => artistPost.report, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reported_post_id' })
  reportedPost: ArtistPost;

  @Column({ nullable: true })
  @IsUUID()
  @Index()
  reported_comment_id: string;

  @ManyToOne(() => Comments, (comment) => comment.report, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reported_comment_id' })
  reportedComment: Comments;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
