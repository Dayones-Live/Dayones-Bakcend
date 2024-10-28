import { Roles } from '@app/shared/constants/constants';
import {
  BaseEntity,
  Column,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { IsEmail, IsNotEmpty, Length } from 'class-validator';
import { UserNotification } from '@user-notifications/entities/user-notifications.entity';
import { Signatures } from '@signature/entities/signature.entity';
import { ArtistPost } from '@app/modules/posts/modules/artist-post/entities/artist-post.entity';
import { ArtistPostUser } from '@app/modules/posts/modules/artist-post-user/entities/artist-post-user.entity';
import { Conversations } from '../modules/chat/conversations/entities/conversation.entity';
import { Message } from '../modules/chat/messages/entities/message.entity';
import { Notifications } from '../modules/ notifications/entities/notifications.entity';
import { CommentReactions } from '@app/modules/posts/modules/comment-reactions/entities/comment-reaction.entity';
import { Comments } from '@app/modules/posts/modules/comments/entities/comments.entity';

@Entity('user')
@Unique(['email'])
@Unique(['phone_number'])
export class User extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  @Index()
  @IsNotEmpty({ message: 'Full Name cannot be empty' })
  @Length(3, 20, { message: 'Full Name must be between 3 and 20 characters' })
  full_name?: string;

  @Column({ nullable: false })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @Column({ nullable: false })
  @IsNotEmpty({ message: 'Phone no is required' })
  @Index()
  phone_number: string;

  @Column({ nullable: false, default: false })
  is_confirmed: boolean = false;

  @Column({ type: 'enum', enum: Roles, array: true, default: [Roles.USER] })
  @IsNotEmpty({ message: 'Role is required' })
  role: Roles[];

  @Column({ nullable: false })
  @IsNotEmpty({ message: 'User Sub is required' })
  @Index()
  user_sub: string;

  @Column({ nullable: true })
  latitude: string;

  @Column({ nullable: true })
  longitude: string;

  @Column({ nullable: true })
  avatar_url: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;

  @Column({ nullable: false, default: true })
  @Index()
  notifications_enabled: boolean;

  @Column({
    type: 'timestamp',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  notification_status_valid_till: Date;

  @OneToOne(() => UserNotification, (userNotification) => userNotification.user)
  userNotification: UserNotification;

  @OneToMany(() => Conversations, (Conversation) => Conversation.sender)
  sentBy: Conversations[];

  @OneToMany(() => Conversations, (Conversation) => Conversation.reciever)
  recievedBy: Conversations[];

  @OneToMany(() => Message, (Conversation) => Conversation.messageSender)
  messageSentBy: Message[];

  @OneToMany(() => Signatures, (signature) => signature.user)
  signature?: Signatures[];

  @OneToMany(() => ArtistPost, (artistPost) => artistPost.user)
  artistPost?: ArtistPost[];

  @OneToMany(() => ArtistPostUser, (artistPostUser) => artistPostUser.user)
  artistPostUser?: ArtistPostUser[];

  @OneToMany(() => Notifications, (notification) => notification.fromUser)
  from?: Notifications[];

  @OneToMany(() => Notifications, (notification) => notification.toUser)
  to?: Notifications[];

  @OneToMany(
    () => CommentReactions,
    (commentReactions) => commentReactions.user,
  )
  commentReactions?: CommentReactions[];

  @OneToMany(() => Comments, (comment) => comment.user)
  comment?: Comments[];
}
