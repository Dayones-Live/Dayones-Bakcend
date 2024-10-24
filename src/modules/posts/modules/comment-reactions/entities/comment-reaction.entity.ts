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
import { Comments } from '../../comments/entities/comments.entity';
import { User } from '@app/modules/user/entities/user.entity';

@Entity({ name: 'comment_reactions' })
export class CommentReactions extends BaseEntity {
  @Column()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsUUID()
  @Index()
  comment_id: string;

  @ManyToOne(() => Comments, (comments) => comments.commentReaction, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'comment_id' })
  comment: Comments;

  @Column()
  @IsUUID()
  @Index()
  liked_by: string;

  @ManyToOne(() => User, (user) => user.commentReactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'liked_by' })
  user: User;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
